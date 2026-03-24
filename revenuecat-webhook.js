const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const cognitoClient = new CognitoIdentityProviderClient({});
const dbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dbClient);

const USER_POOL_ID = process.env.USER_POOL_ID;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || "MaintenanceVault-Users";
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

exports.handler = async (event) => {
    console.log("RevenueCat Webhook Event:", JSON.stringify(event, null, 2));

    // Security check: Verify RevenueCat Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
        console.error("Unauthorized webhook attempt");
        return { statusCode: 401, body: "Unauthorized" };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: "Invalid JSON" };
    }

    const { event: rcEvent } = body;

    // We only care about purchase-related events that grant entitlements
    const upgradeEvents = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'TRANSFER'];
    if (!upgradeEvents.includes(rcEvent.type)) {
        return { statusCode: 200, body: "Event ignored" };
    }

    const userId = rcEvent.app_user_id; // This is the Cognito 'sub' we passed during configure()
    const entitlementId = 'Premium'; // The entitlement ID defined in RevenueCat

    const hasPremium = rcEvent.entitlement_ids && rcEvent.entitlement_ids.includes(entitlementId);

    if (hasPremium) {
        try {
            // 1. Update Cognito User Attribute
            await cognitoClient.send(new AdminUpdateUserAttributesCommand({
                UserPoolId: USER_POOL_ID,
                Username: userId,
                UserAttributes: [
                    { Name: "custom:tier", Value: "Premium" }
                ]
            }));

            // 2. Update User Status in DynamoDB Users table
            await docClient.send(new PutCommand({
                TableName: USERS_TABLE_NAME,
                Item: {
                    userId: userId,
                    tier: "Premium",
                    updatedAt: new Date().toISOString()
                }
            }));

            console.log(`User ${userId} upgraded to Premium`);

        } catch (error) {
            console.error("Error updating user tier:", error);
            return { statusCode: 500, body: "Internal Server Error" };
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Webhook processed" })
    };
};
