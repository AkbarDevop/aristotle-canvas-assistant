import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

interface InstalledCredentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export async function authorizeGoogleClient(
  credentialsPath: string,
  tokenPath: string,
  scopes: string[],
) {
  const credentials = await loadCredentials(credentialsPath);
  const oauth2Client = new google.auth.OAuth2(
    credentials.installed.client_id,
    credentials.installed.client_secret,
    credentials.installed.redirect_uris[0],
  );

  try {
    const tokenRaw = await readFile(tokenPath, "utf8");
    oauth2Client.setCredentials(JSON.parse(tokenRaw));
    return oauth2Client;
  } catch {
    const auth = await authenticate({
      scopes,
      keyfilePath: credentialsPath,
    });

    await mkdir(path.dirname(tokenPath), { recursive: true });
    await writeFile(tokenPath, JSON.stringify(auth.credentials, null, 2));
    oauth2Client.setCredentials(auth.credentials);
    return oauth2Client;
  }
}

async function loadCredentials(credentialsPath: string): Promise<InstalledCredentials> {
  return JSON.parse(await readFile(credentialsPath, "utf8")) as InstalledCredentials;
}
