#!/usr/bin/env node
// Prints a VAPID key pair for web push. Run once, then set the values in the
// environment. Regenerating the pair invalidates every existing subscription,
// so keep them.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("Add these to .env.local and to the deployment environment:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log("\nVAPID_PRIVATE_KEY is a secret — never commit it.");
