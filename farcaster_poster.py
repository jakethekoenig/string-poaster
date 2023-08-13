from farcaster import Warpcast
from farcaster.models import Parent
import sys
# from dotenv import load_dotenv # can be installed with `pip install python-dotenv`

# load_dotenv()

client = Warpcast(mnemonic=sys.argv[1])

response = None
for poast in sys.argv[2:]:
    if response is None:
        response = client.post_cast(text=poast)
        # response = client.post_cast(text=poast, embeds=['https://ja3k.com/asset/pic/cow.jpg'])
    else:
        parent = Parent(hash=response.cast.hash, fid=response.cast.author.fid)
        response = client.post_cast(text=poast, parent=parent)

