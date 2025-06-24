# Supproo End-to-End Testing Guide

[![Onboarding CI](https://github.com/Nickan17/suppcodex/actions/workflows/onboarding.yml/badge.svg)](https://github.com/Nickan17/suppcodex/actions/workflows/onboarding.yml)
*This badge ensures all onboarding scripts and dependencies stay valid.*

This guide provides a complete, step-by-step workflow for setting up this project, deploying the Supabase Edge Functions, and running a smoke test to verify the entire pipeline. It is designed to be followed by a new developer from start to finish.

## 🚀 Getting Started: Initial Setup

### Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js & npm:** [Download & Install Node.js](https://nodejs.org/)
*   **Supabase CLI:** [Installation Guide](https://supabase.com/docs/guides/cli/getting-started)

### Step 1: Clone the Repository

Get a local copy of the project.

```bash
git clone <repository-url>
cd <repository-directory>
```

### Step 2: Authenticate with Supabase

You must log in to your Supabase account through the CLI. This will open a browser window for you to authorize the application.

```bash
supabase login
```

### Step 3: Install Dependencies

Install the necessary Node.js packages defined in `package.json`.

```bash
npm install
```

### Step 4: Configure Environment Variables

The project requires API keys and secrets to communicate with your Supabase project.

1.  **Create a `.env.local` file from the template:**
    ```bash
    cp .env.example .env.local
    ```
2.  **Add your Supabase credentials:**
    Open the new `.env.local` file and fill in the values. You can find these in your **Supabase Dashboard** under **Project Settings > API**.

---

## ⚡ Deployment & Smoke Test

This workflow deploys the Supabase functions and runs a test to ensure the UPC-to-score pipeline is fully operational.

### Step 1: Deploy the Edge Functions

Choose the command that matches your environment.

*   **For local development (disables JWT verification):**
    ```bash
    npm run deploy:dev
    ```
*   **For staging or production (enables JWT verification):**
    ```bash
    npm run deploy:prod
    ```

### Step 2: Generate a Service-Role Token (for Prod/Staging)

If you deployed with `deploy:prod`, you need a `service_role` token to run the test script. This command reads the secret from your `.env.local` file and creates a temporary token file (`sr.jwt`).

```bash
node gen_service_jwt.js > sr.jwt
```
*(You can skip this step if you used `deploy:dev`)*.

### Step 3: Run the Pipeline Smoke Test

Execute the PowerShell test script with a known UPC. This script calls the `full-score-from-upc` endpoint, which triggers the entire data processing pipeline.

```powershell
# Read the token from the file (omit this line if you used deploy:dev)
$jwt = Get-Content .\sr.jwt

# Run the test against a sample UPC
./test_full_score.ps1 850017020276 $jwt
```

### Step 4: Verify the Results

A successful test is confirmed by checking two places:

1.  **Function Logs:**
    In a separate terminal, run the `logs` command to stream the function logs from your project.
    ```bash
    npm run logs
    ```
    Look for the line: `💡 FCE POST body: {"url":"https://..."}`. This confirms the `firecrawl-extract` function was invoked.

2.  **Database:**
    Check the `scored_products` table in your Supabase project via the **Table Editor** in the dashboard. A new row for the UPC you tested (`850017020276`) should have been created or updated.

When both are confirmed, the pipeline is working correctly from end to end.