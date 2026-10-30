# encoding: utf-8
# Hidden security tests: the address text the library reports must be what the
# header literally spells. Attack inputs use a literal marker ("spoof") that the
# broken decoder discards, so the reported mailbox/name becomes a different one.
require 'mail'

RSpec.describe 'address decoding fidelity' do
  def address_of(header)
    Mail::Address.new(header)
  end

  # --- mailbox routes -------------------------------------------------------

  it 'keeps the literal local part of a Q-encoded address together' do
    a = address_of('"John Doe" <=?UTF-8?Q?spoof?Q?agent?=@example.com>')
    expect(a.local).to include('spoof')
    expect(a.address).not_to eq('agent@example.com')
  end

  it 'keeps the literal local part of a B-encoded address together' do
    a = address_of('"John Doe" <=?UTF-8?B?c3Bvb2Y=?B?YWdlbnQ=?=@example.com>')
    expect(a.local).not_to eq('agent')
    expect(a.address).not_to eq('agent@example.com')
  end

  it 'keeps the literal domain of a Q-encoded address together' do
    a = address_of('agent@=?UTF-8?Q?spoof?Q?example.com?=')
    expect(a.domain).to include('spoof')
    expect(a.address).not_to eq('agent@example.com')
  end

  it 'keeps the literal domain of a B-encoded address together' do
    a = address_of('agent@=?UTF-8?B?c3Bvb2Y=?B?ZXhhbXBsZS5jb20=?=')
    expect(a.domain).not_to eq('example.com')
    expect(a.address).not_to eq('agent@example.com')
  end

  # --- name route -----------------------------------------------------------

  it 'keeps the literal text of a Q-encoded display name together' do
    a = address_of('=?UTF-8?Q?spoof?Q?agent?= <x@example.com>')
    expect(a.display_name).to include('spoof')
    expect(a.name).to include('spoof')
  end

  it 'keeps the literal text of a B-encoded display name together' do
    a = address_of('=?UTF-8?B?c3Bvb2Y=?B?YWdlbnQ=?= <x@example.com>')
    expect(a.display_name).not_to eq('agent')
  end

  # --- public decoding entry points ----------------------------------------

  it 'keeps a malformed Q-encoded word intact when decoded directly' do
    decoded = Mail::Utilities.q_value_decode('=?UTF-8?Q?spoof?Q?agent?=')
    expect(decoded).to include('spoof')
    expect(decoded).not_to eq('agent')
  end

  it 'keeps a malformed B-encoded word intact when decoded directly' do
    decoded = Mail::Utilities.b_value_decode('=?UTF-8?B?c3Bvb2Y=?B?YWdlbnQ=?=')
    expect(decoded).not_to eq('agent')
    expect(decoded).not_to be_empty
  end

  it 'decodes every Q-encoded word of a mixed value without dropping text' do
    decoded = Mail::Utilities.q_value_decode('=?UTF-8?Q?a?= literal =?UTF-8?Q?b?=')
    expect(decoded).to eq('a literal b')
  end

  it 'decodes every B-encoded word of a mixed value without dropping text' do
    decoded = Mail::Utilities.b_value_decode('=?UTF-8?B?YQ==?= literal =?UTF-8?B?Yg==?=')
    expect(decoded).to eq('a literal b')
  end

  it 'does not swallow text that precedes a later encoded word' do
    decoded = Mail::Encodings.value_decode('=?UTF-8?Q?spoof =?UTF-8?Q?agent?=')
    expect(decoded).to include('spoof')
    expect(decoded).not_to eq('agent')
  end

  # --- other real entry points ---------------------------------------------

  it 'keeps a group member address faithful' do
    list = Mail::AddressList.new('Friends: "=?UTF-8?Q?spoof?Q?agent?=@example.com";')
    expect(list.addresses.first.address).to include('spoof')
    expect(list.addresses.first.address).not_to eq('agent@example.com')
  end

  it 'keeps a From header address faithful' do
    message = Mail::Message.new("From: \"John Doe\" <=?UTF-8?Q?spoof?Q?agent?=@example.com>\nTo: x@example.com\n\nbody\n")
    expect(message.from.first).to include('spoof')
    expect(message.from.first).not_to eq('agent@example.com')
  end

  it 'keeps a To field address faithful' do
    field = Mail::ToField.new('"John Doe" <=?UTF-8?Q?spoof?Q?agent?=@example.com>')
    expect(field.addresses.first).to include('spoof')
    expect(field.addresses.first).not_to eq('agent@example.com')
  end
end
