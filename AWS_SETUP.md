# AWS Cognito Setup Instructions for MaintenanceVault

To set up the authentication layer for MaintenanceVault, follow these steps in the AWS Console:

### 1. Create a Cognito User Pool
1. Go to the **Amazon Cognito** console.
2. Click **Create user pool**.
3. **Configure sign-in experience**:
   - Select **Email** under "Cognito user pool sign-in options".
   - Keep other defaults and click **Next**.
4. **Configure security settings**:
   - Keep default password policy or adjust as needed.
   - Select "No MFA" (for Phase 1 simplicity) or "Optional MFA".
   - Click **Next**.
5. **Configure sign-up experience**:
   - Keep "Self-registration" enabled.
   - Under **Required attributes**, ensure **email** is selected.
   - **Add custom attribute**:
     - Name: `tier`
     - Type: `String`
     - Min length: `1`, Max length: `20`
     - Mutable: **Checked** (allows upgrading to Pro later).
   - Click **Next**.
6. **Configure message delivery**:
   - Select "Send email with Cognito" for testing (limit 50 emails/day) or use Amazon SES for production.
   - Click **Next**.
7. **Integrate your app**:
   - **User pool name**: `MaintenanceVault-Users`
   - **Initial app client**:
     - App client name: `MaintenanceVault-PWA`
     - Client secret: **Don't generate a client secret** (required for browser-based calls).
   - Click **Next**.
8. **Review and create**:
   - Review your settings and click **Create user pool**.

### 2. Note Your IDs
Once created, note down the following for the `index.html` configuration:
- **User Pool ID** (e.g., `us-east-1_XXXXXXXXX`)
- **App Client ID** (e.g., `7h8...`)
- **Region** (e.g., `us-east-1`)

### 3. Default "Free" Tier
The application logic is designed to pass `custom:tier = "Free"` during the sign-up process. Any user without this attribute or with this value will be subject to the 5-asset limit.
