# Setup

First you'll need a working version of PostgreSQL installed locally. If you don't have it, install Postgres.app and follow the PostgreSQL documentation to make sure you have the appropriate role permissions to run commands from your terminal.

The members of the network are identified by their wallet, but they are registered and known to the contract owner, who serves as the administrator of the network. The contract owner/administrator maintains a database of each member's identity which is not stored on chain. 

Create this database:
```
createdb blockchain-carbon-accounting
```

In the repository root directory copy `.env.SAMPLE` to `.env` and fill in the configuration set up:
- Your PostgreSQL host, port, username, and password.  
- The Google API key for the [Google DistanceMatrix API](https://developers.google.com/maps/documentation/distance-matrix/overview) and [Google Geocode API](https://developers.google.com/maps/documentation/geocoding/overview). (You may need to click "Get Started" and sign up for a free Google Cloud trial)
- If you have access to the [UPS Developer Kit](https://www.ups.com/upsdeveloperkit?loc=en_US), your UPS username, password, and access key.
- Email sending parameters.
- Smart contract addresses.

IPFS is used for storing the documents that members of the network will submit to auditors to review and verify.
Install ipfs and run:
```
ipfs daemon --enable-pubsub-experiment
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
```

Make sure you're using node version 16.  Check it with this command in every terminal:
```
node -v
```

If it's not switch to node version 16
```
nvm use 16
```

In the repository root directory run:

```
npm run clean:nodemodules
npm install
npm run loadSeeds
```
