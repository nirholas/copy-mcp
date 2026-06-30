#!/usr/bin/env node
// @three-ws/copy-mcp — MCP server entry point.
//
// The copy-trading control surface for an AI agent's OWN follow/guard/earn
// relationships on three.ws. Headless, non-custodial — three.ws never signs or
// holds funds; it emits sized, guard-checked copy INTENTS the copier acts on.
//
//   • list_subscriptions  — every leader you follow + status + guards + counts
//   • create_subscription — follow a leader / re-tune the follow (idempotent)
//   • update_subscription — pause / resume / stop, or change sizing & guards
//   • cancel_subscription — soft-stop a follow (destructive; keeps history)
//   • get_executions      — your copy-intent inbox + history
//   • record_execution    — mark a pending intent acted-on / dismissed
//   • get_earnings        — fees owed (yours) or a leader's public aggregate
//
// Account-scoped: set THREE_WS_API_KEY to a three.ws API key (sk_live_…) or
// OAuth access token. The only public read is a leader's aggregate earnings.
//
// Run standalone:
//   THREE_WS_API_KEY=sk_live_… node packages/copy-mcp/src/index.js
//
// Or wire into Claude Code / Cursor — see README.md.

import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { def as listSubscriptions } from './tools/list-subscriptions.js';
import { def as createSubscription } from './tools/create-subscription.js';
import { def as updateSubscription } from './tools/update-subscription.js';
import { def as cancelSubscription } from './tools/cancel-subscription.js';
import { def as getExecutions } from './tools/get-executions.js';
import { def as recordExecution } from './tools/record-execution.js';
import { def as getEarnings } from './tools/get-earnings.js';

// Single source of truth for the advertised server version — package.json.
const require = createRequire(import.meta.url);
const { version: PKG_VERSION } = require('../package.json');

export const TOOLS = [
	listSubscriptions,
	createSubscription,
	updateSubscription,
	cancelSubscription,
	getExecutions,
	recordExecution,
	getEarnings,
];

/**
 * Construct a fully-registered McpServer without connecting a transport.
 * Registration is env-free (the API key is only read at call time), so this is
 * safe to import from tests.
 * @returns {McpServer}
 */
export function buildServer() {
	const server = new McpServer(
		{ name: 'copy-mcp', title: 'three.ws Copy Trading', version: PKG_VERSION },
		{
			capabilities: { tools: {} },
			instructions:
				'three.ws Copy Trading MCP — manage your OWN copy-trade relationships headlessly. ' +
				'list_subscriptions shows every leader you follow with status, sizing, and guard rules. ' +
				'create_subscription follows a leader and defines how their trades size into your wallet ' +
				'(idempotent — re-call to re-tune); update_subscription pauses/resumes/stops a follow or ' +
				'changes its caps, budget, market-cap band, and safety gates; cancel_subscription soft-stops ' +
				'it (history preserved). get_executions is your copy-intent inbox; record_execution marks a ' +
				'pending intent acted-on or dismissed. get_earnings reports the fees you owe across the ' +
				'leaders you copy, or a leader\'s public aggregate earnings. NON-CUSTODIAL: three.ws never ' +
				'signs or holds funds — copies are sized, guard-checked INTENTS you execute yourself, always ' +
				'clamped to your per-trade cap and daily budget. Account-scoped: set THREE_WS_API_KEY. ' +
				'Performance fees settle in $THREE.',
		},
	);

	for (const tool of TOOLS) {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: tool.annotations,
			},
			async (args, extra) => {
				try {
					const result = await tool.handler(args, extra);
					const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
					return { content: [{ type: 'text', text }] };
				} catch (err) {
					const payload = {
						ok: false,
						error: err?.code || 'unhandled',
						message: err?.message || String(err),
						...(err?.status ? { status: err.status } : {}),
					};
					return {
						content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
						isError: true,
					};
				}
			},
		);
	}

	return server;
}

async function main() {
	const server = buildServer();
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`[copy-mcp@${PKG_VERSION}] connected over stdio with ${TOOLS.length} tools`);
}

// Connect stdio ONLY when this file is the process entry point. Importing the
// module (tests, embedding) must not grab the transport. realpath both sides:
// npm bin shims are symlinks, so argv[1] may differ from import.meta.url.
function isProcessEntryPoint() {
	if (!process.argv[1]) return false;
	try {
		return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
	} catch {
		return false;
	}
}

if (isProcessEntryPoint()) {
	main().catch((err) => {
		console.error('[copy-mcp] fatal:', err);
		process.exit(1);
	});
}
