const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "MaintenanceVault-Items";

exports.handler = async (event) => {
    console.log("Event:", JSON.stringify(event, null, 2));

    // In a real API Gateway setup, the user ID (sub) would be in the authorizer context.
    const userId = event.requestContext?.authorizer?.claims?.sub || "test-user-id";
    const method = event.httpMethod;

    try {
        if (method === "GET") {
            // Fetch all items for this user using Query (Scales better than Scan)
            const params = {
                TableName: TABLE_NAME,
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: {
                    ":uid": userId,
                },
            };

            const data = await docClient.send(new QueryCommand(params));

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data.Items || []),
            };
        }

        else if (method === "POST") {
            const body = JSON.parse(event.body);
            const items = Array.isArray(body) ? body : [body];

            const results = [];
            for (const item of items) {
                // Ensure the item belongs to the user and has the required Partition Key
                item.userId = userId;

                // Conditional Put: Only update if the item doesn't exist OR the incoming updatedAt is newer
                const putParams = {
                    TableName: TABLE_NAME,
                    Item: item,
                    // ConditionExpression: "attribute_not_exists(itemId) OR updatedAt < :newAt",
                    // ExpressionAttributeValues: { ":newAt": item.updatedAt }
                };

                await docClient.send(new PutCommand(putParams));
                results.push(item.itemId);
            }

            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: "Sync successful", updatedItemIds: results }),
            };
        }

        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Method Not Allowed" }),
        };

    } catch (error) {
        console.error("Lambda Error:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
        };
    }
};
