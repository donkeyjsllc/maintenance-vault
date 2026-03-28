# MaintenanceVault Database & Sync Architecture

## DynamoDB Schema

To support scalable, multi-user storage with offline-first capabilities, the following DynamoDB structure is proposed:

**Table Name:** `MaintenanceVault-Items`

| Attribute | Type | Description |
| :--- | :--- | :--- |
| `userId` | String (PK) | The Cognito `sub` (UUID) of the authenticated user. |
| `itemId` | String (SK) | A unique ID for the maintenance item (e.g., timestamp or UUID). |
| `name` | String | Name of the maintenance task (e.g., "Oil Change"). |
| `category` | String | "Vehicle", "Property", or "Equipment". |
| `part` | String | Part number or specifications. |
| `type` | String | "replace" or "repair". |
| `notes` | String | User notes and specs. |
| `date` | String | The date the maintenance was performed (ISO 8601). |
| `updatedAt` | String | The last time the record was modified (ISO 8601). |
| `isDeleted` | Boolean | Soft delete flag for synchronization. |

**Table Name:** `MaintenanceVault-Users`

| Attribute | Type | Description |
| :--- | :--- | :--- |
| `userId` | String (PK) | The Cognito `sub` (UUID) of the authenticated user. |
| `tier` | String | "Free" or "Pro". |
| `updatedAt` | String | Last modified timestamp (ISO 8601). |

### Why this PK/SK?
Using `userId` as the Partition Key ensures that all data for a single user is co-located, allowing for efficient queries of a user's entire vault. Using `itemId` as the Sort Key allows for unique identification of items and efficient updates/deletes.

---

## Sync Strategy: Offline-First & Last-Write-Wins

The application prioritizes local storage for immediate responsiveness (Optimistic UI) and syncs to the cloud asynchronously.

### Conflict Resolution
We use a **Last-Write-Wins (LWW)** strategy based on the `updatedAt` timestamp.

1.  **Local Update:** When an item is added, edited, or deleted, the local `vaultData` is updated immediately, and a new `updatedAt` timestamp is generated.
2.  **Cloud Sync:**
    -   The client fetches the latest state from DynamoDB.
    -   For each item, the client compares the local `updatedAt` with the cloud `updatedAt`.
    -   If `local.updatedAt > cloud.updatedAt`, the cloud is updated with the local version.
    -   If `cloud.updatedAt > local.updatedAt`, the local storage is updated with the cloud version.
3.  **Soft Deletes:** Items are not immediately removed from the database. Instead, `isDeleted` is set to `true`. This ensures that a deletion on one device is propagated to others during their next sync.

## API Layer
A single Lambda function handles both fetching and upserting data via an API Gateway endpoint.

-   **GET /sync:** Returns all items for the authenticated user.
-   **POST /sync:** Accepts an array of items and performs a `BatchWriteItem` or multiple `PutItem` operations with conditional checks on `updatedAt`.
