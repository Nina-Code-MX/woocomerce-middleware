# woocomerce-middleware


## 1. Description

The objective of this scripts is to process the Orders Webhook from WooCOmmerce and pass them out filtered to the Reservation API.

## 2. Instructions

### 2.1. Install Dedepncies

```bash
npm install --global tsc
npm install aws-lambda dotenv express smee-client
npm install --save-dev typescript @types/aws-lambda @types/express @types/node
```

### 2.2. Testing Local

Copy the `.env.example` to `.env` and change the necessary values

Run the node dev script:

```bash
npm run dev
```

From the output you will see that the localhost host is running and the smee url is forwarding to your host.

### 2.3. Deploying production


#### 2.3.1. Deploy the code in AWS Lambda

Build the code:

```bash
npx tsc
```

Open the file `./build/lambda.js` and copy its contetn.

Open the AWS Console and go to AWS Lambda, open the `WooCommerceMiddleware`, edit the code by pasting the content copied above.

#### 2.3.2. Set the Webhooks

In wordpress, go the WooCommerce > Settings > Advanced > Webhooks

Create two Webhooks, one for `Order Created` and other for `Order Updated`, in the endpoint provide: `https://aahspfo3cl.execute-api.us-west-2.amazonaws.com`

> NOTE: You can get that url from AWS Lambda > Configuration > Triggers

#### 2.3.3. Test and Debug

- Create or update an Order in the WordPress Admin Panel
- Create an Order from the Store
- Call the API Gateway direcly from curl or Postman

To review the logs for the execution you can get them from: AWS CloudWatch > Logs > Log Groups, and open the strem for `/aws/lambda/WooCommerceMiddleware`