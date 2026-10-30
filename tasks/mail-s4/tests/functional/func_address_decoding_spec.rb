# encoding: utf-8
# Hidden functional tests: legitimate address and header decoding must keep
# working exactly as it does today, including values next to the ones the
# security tests drive. These pass on the unmodified project.
require 'mail'

RSpec.describe 'address decoding of legitimate values' do
  it 'decodes a legitimate Q-encoded display name' do
    a = Mail::Address.new('=?UTF-8?Q?This_is_=E3=81=82_string?= <a@example.com>')
    expect(a.display_name).to eq('This is あ string')
    expect(a.address).to eq('a@example.com')
  end

  it 'decodes a legitimate B-encoded display name' do
    a = Mail::Address.new('=?UTF-8?B?44G/44GR44KL?= <a@example.com>')
    expect(a.display_name).to eq('みける')
  end

  it 'decodes a display name that mixes literal text and several encoded words' do
    a = Mail::Address.new('=?UTF-8?Q?Hi?= there =?UTF-8?Q?you?= <a@example.com>')
    expect(a.display_name).to eq('Hi there you')
  end

  it 'decodes a legitimate encoded local part' do
    expect(Mail::Address.new('=?UTF-8?Q?agent?=@example.com').address).to eq('agent@example.com')
    expect(Mail::Address.new('=?UTF-8?B?YWdlbnQ=?=@example.com').address).to eq('agent@example.com')
  end

  it 'decodes a legitimate encoded domain' do
    expect(Mail::Address.new('x@=?UTF-8?Q?example.com?=').domain).to eq('example.com')
  end

  it 'keeps a payload that contains an unencoded question mark' do
    expect(Mail::Address.new('=?UTF-8?Q?what?is?=@example.com').local).to eq('what?is')
    expect(Mail::Utilities.q_value_decode('=?UTF-8?Q?what?is?=')).to eq('what?is')
  end

  it 'returns the payload of a word whose charset is unknown' do
    expect(Mail::Encodings.value_decode('=?BAD-ENCODING?B?VEVTVA==?=')).to eq('TEST')
    expect(Mail::Utilities.b_value_decode('=?BAD-ENCODING?B?VEVTVA==?=')).to eq('TEST')
  end

  it 'decodes a blank encoded word to an empty string' do
    expect(Mail::Encodings.value_decode('=?utf-8?Q??=')).to eq('')
    expect(Mail::Encodings.value_decode('=?utf-8?B??=')).to eq('')
  end

  it 'joins adjacent encoded words without the separating white-space' do
    expect(Mail::Encodings.value_decode('=?UTF-8?Q?a?= =?UTF-8?Q?b?=')).to eq('ab')
  end

  it 'decodes a value that mixes literal text and encoded words' do
    expect(Mail::Encodings.value_decode('=?UTF-8?Q?a?= literal =?UTF-8?Q?b?=')).to eq('a literal b')
  end

  it 'leaves text without encoded words untouched' do
    expect(Mail::Encodings.value_decode('plain text')).to eq('plain text')
    expect(Mail::Utilities.q_value_decode('plain text')).to eq('plain text')
  end

  it 'decodes the display name of a From header without changing the mailbox' do
    message = Mail::Message.new("From: =?UTF-8?Q?This_is_=E3=81=82_string?= <a@example.com>\nTo: b@example.com\n\nbody\n")
    expect(message.from.first).to eq('a@example.com')
    expect(message[:from].display_names.first).to eq('This is あ string')
  end
end
