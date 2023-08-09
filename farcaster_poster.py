from farcaster import Warpcast
import sys
# from dotenv import load_dotenv # can be installed with `pip install python-dotenv`

# load_dotenv()

client = Warpcast(mnemonic=sys.argv[1])

print(client.get_healthcheck())

response = client.post_cast(text=sys.argv[2])
