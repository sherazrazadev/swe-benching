# Sounds stored by the daemon must really be playable audio

## The system

This repository is the daemon of a small robot. It runs on the robot, exposes the daemon's
network interfaces to local applications, and keeps the sound files that clients send it so they
can be played through the robot's speaker. The daemon stores those files in a temporary area on
its own filesystem and plays them with the same media stack it uses for every other sound.

## Observed impact

A client sends a file named `setup.sh` whose body is a shell script. The daemon accepts the
request, writes the script into its sound area and reports success. The same happens with a file
named like a sound that actually contains arbitrary bytes, and with an upload whose size is
bounded only by what the client is willing to send. Anything that later uses the sound area
therefore receives files that the daemon never checked were playable audio.

## What must hold

Whatever a client supplies that the daemon stores on disk, however it arrives, must be a complete,
playable audio stream:

- its content must decode as audio on the daemon's own media stack;
- it must be stored under a file extension this daemon recognises as audio;
- one stored file must be no larger than 25 MiB.

If any of that does not hold, the daemon must refuse the request and leave the filesystem as it
was: no new file appears, and an existing file that the request would have replaced keeps its
previous content. Where the request has a response, a refusal is a client error; where the
protocol gives the client no response, the refused content must simply not be stored.

The examples above are examples of how the flaw shows up, not an exhaustive list of inputs,
routes or shapes. Reason about the property, not the samples.

## What must keep working

Everything that works today keeps working exactly as today, including:

- A genuine sound in any container the daemon already plays — for example WAV, OGG/Opus, FLAC or
  MP3 — is still accepted and stored under its own name, and an uppercase extension still works.
- Uploading a sound whose name matches an existing one still replaces that file.
- A name that includes a directory prefix is still reduced to its base name.
- A genuine sound just under the size limit is still accepted.
- A successful response keeps its shape, and the path it returns still points at the stored file.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix or an advisory for this project.
- Do not special-case the example inputs.
- There is no network access.
