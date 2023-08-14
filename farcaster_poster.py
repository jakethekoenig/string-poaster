#!/usr/bin/python3

from farcaster import Warpcast
from farcaster.models import Parent
import sys

mnemonic = sys.argv[1]
poast = sys.argv[2]
parent_hash = sys.argv[3]
parent_fid = sys.argv[4]
embeds = sys.argv[5:]

client = Warpcast(mnemonic=mnemonic)

if parent_hash == 'None':
    response = client.post_cast(text=poast, embeds=embeds)
else:
    parent = Parent(hash=parent_hash, fid=parent_fid)
    response = client.post_cast(text=poast, parent=parent, embeds=embeds)

print(response.cast.hash)
print(response.cast.author.fid)
