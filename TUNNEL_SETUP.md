# Cloudflare Tunnel Setup Guide

This guide explains how to expose your local development environment using Cloudflare Tunnel.

## Prerequisites

- Cloudflare account with an active zone (domain).
- `cloudflared` installed on your machine.

## 1. Install cloudflared

Check if it's already installed:
```bash
cloudflared --version
```

If not, install it using Homebrew:
```bash
brew install cloudflared
```

## 2. Authenticate

Login to your Cloudflare account:
```bash
cloudflared tunnel login
```
This will open a browser window. Select your domain to authorize the tunnel.

## 3. Create a Tunnel

Create a new tunnel (replace `my-tunnel` with a name of your choice):
```bash
cloudflared tunnel create my-tunnel
```
Copy the **Tunnel ID** from the output. You will need it in the next step.

## 4. Configure the Tunnel

1. Open `tunnel-config.yml` in the root of this project.
2. Replace `<Your-Tunnel-ID>` with the ID you copied in Step 3.
3. Replace `<your-chosen-hostname>` with the full domain you want to use (e.g., `dev.telnyx.solutions`).
   - **Note:** You can remove the `hostname` lines if you want this rule to apply to *all* hostnames routed to this tunnel, but specifying it is safer.
   - **Important:** Make sure the hostname matches the DNS record you will create in Step 5.

## 5. Route DNS

Route traffic from your domain to the tunnel:
```bash
cloudflared tunnel route dns my-tunnel <your-chosen-hostname>
```
Example: `cloudflared tunnel route dns my-tunnel dev.telnyx.solutions`

## 6. Run the Tunnel

Start the tunnel using your configuration file:
```bash
cloudflared tunnel run --config tunnel-config.yml my-tunnel
```

## 7. Verify

Visit `https://<your-chosen-hostname>` in your browser.
- The React app should load.
- API requests to `/api/*` should be routed to your local backend.
