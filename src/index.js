/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { WorkflowEntrypoint } from "cloudflare:workers";
import { Hono } from "hono";
import Mistral from "@mistralai/mistralai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export class RAGWorkflow extends WorkflowEntrypoint {
	async run(event, step) {
		const env = this.env;
		const { text } = event.payload;

		let texts = await step.do("split text", async () => {
			const splitter = new RecursiveCharacterTextSplitter();
			const output = await splitter.createDocuments([text]);
			return output.map((doc) => doc.pageContent);
		});

		console.log(
			`RecursiveCharacterTextSplitter generated ${texts.length} chunks`,
		);

		for (const index in texts) {
			const text = texts[index];

			const record = await step.do(
				`create database record: ${index}/${texts.length}`,
				async () => {
					const query = "INSERT INTO notes (text) VALUES (?) RETURNING *";

					const { results } = await env.DB.prepare(query).bind(text).run();

					const record = results[0];
					if (!record) throw new Error("Failed to create note");
					return record;
				},
			);

			const embedding = await step.do(
				`generate embedding: ${index}/${texts.length}`,
				async () => {
					const embeddings = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
						text: text,
					});
					const values = embeddings.data[0];
					if (!values)
						throw new Error("Failed to generate vector embedding");
					return values;
				},
			);

			await step.do(`insert vector: ${index}/${texts.length}`, async () => {
				return env.VECTOR_INDEX.upsert([
					{
						id: record.id.toString(),
						values: embedding,
					},
				]);
			});
		}
	}
}

const app = new Hono();

// Serve the chat UI interface
app.get("/", async (c) => {
	return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Danish Personal Assistant</title>
	<style>
		@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
		
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		:root {
			--primary-gradient: linear-gradient(135deg,rgb(115, 116, 120) 0%,rgb(26, 22, 30) 100%);
			--secondary-gradient: linear-gradient(135deg,rgb(84, 82, 84) 0%,rgb(58, 0, 8) 100%);
			--dark-gradient: linear-gradient(135deg,rgb(0, 0, 0) 0%,rgb(20, 56, 4) 100%);
			--glass-bg: rgba(255, 255, 255, 0.95);
			--glass-border: rgba(255, 255, 255, 0.18);
			--shadow-soft: 0 8px 32px 0 rgba(255, 255, 255, 0.51);
			--shadow-hover: 0 15px 35px rgba(215, 215, 215, 0.4);
		}
		
		body {
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg,rgb(64, 64, 64) 0%,rgb(192, 192, 192) 50%,rgb(0, 0, 0) 100%);
			background-size: 400% 400%;
			animation: gradientShift 15s ease infinite;
			height: 100vh;
			display: flex;
			justify-content: center;
			align-items: center;
			padding: 20px;
			position: relative;
			overflow: hidden;
		}
		
		body::before {
			content: '';
			position: absolute;
			width: 200%;
			height: 200%;
			background: radial-gradient(circle, rgba(130, 130, 130, 0.1) 1px, transparent 1px);
			background-size: 50px 50px;
			animation: float 20s linear infinite;
			opacity: 0.3;
		}
		
		@keyframes gradientShift {
			0% { background-position: 0% 50%; }
			50% { background-position: 100% 50%; }
			100% { background-position: 0% 50%; }
		}
		
		@keyframes float {
			0% { transform: translate(0, 0) rotate(0deg); }
			100% { transform: translate(-50px, -50px) rotate(360deg); }
		}
		
		.chat-container {
			width: 100%;
			max-width: 900px;
			height: 92vh;
			background: var(--glass-bg);
			backdrop-filter: blur(20px);
			-webkit-backdrop-filter: blur(20px);
			border-radius: 30px;
			border: 1px solid var(--glass-border);
			box-shadow: var(--shadow-soft);
			display: flex;
			flex-direction: column;
			overflow: hidden;
			position: relative;
			animation: containerSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
		}
		
		@keyframes containerSlideIn {
			from {
				opacity: 0;
				transform: translateY(30px) scale(0.95);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
		
		.chat-header {
			background: var(--primary-gradient);
			color: white;
			padding: 25px 30px;
			text-align: center;
			position: relative;
			overflow: hidden;
		}
		
		.chat-header::before {
			content: '';
			position: absolute;
			top: -50%;
			left: -50%;
			width: 200%;
			height: 200%;
			background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
			background-size: 30px 30px;
			animation: headerFloat 15s linear infinite;
		}
		
		@keyframes headerFloat {
			0% { transform: translate(0, 0); }
			100% { transform: translate(30px, 30px); }
		}
		
		.chat-header h1 {
			font-size: 28px;
			font-weight: 700;
			letter-spacing: -0.5px;
			position: relative;
			z-index: 1;
			text-shadow: 0 2px 10px rgba(0,0,0,0.2);
			animation: titlePulse 2s ease-in-out infinite;
		}
		
		@keyframes titlePulse {
			0%, 100% { transform: scale(1); }
			50% { transform: scale(1.02); }
		}
		
		.chat-messages {
			flex: 1;
			overflow-y: auto;
			padding: 30px;
			background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
			position: relative;
		}
		
		.chat-messages::-webkit-scrollbar {
			width: 8px;
		}
		
		.chat-messages::-webkit-scrollbar-track {
			background: transparent;
		}
		
		.chat-messages::-webkit-scrollbar-thumb {
			background: linear-gradient(135deg, #667eea, #764ba2);
			border-radius: 10px;
		}
		
		.chat-messages::-webkit-scrollbar-thumb:hover {
			background: linear-gradient(135deg, #764ba2, #667eea);
		}
		
		.message {
			margin-bottom: 20px;
			display: flex;
			animation: messageSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
			opacity: 0;
			animation-fill-mode: forwards;
		}
		
		@keyframes messageSlideIn {
			from {
				opacity: 0;
				transform: translateY(20px) scale(0.95);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
		
		.message.user {
			justify-content: flex-end;
			animation-delay: 0.1s;
		}
		
		.message.bot {
			justify-content: flex-start;
			animation-delay: 0.1s;
		}
		
		.message-content {
			max-width: 75%;
			padding: 16px 20px;
			border-radius: 24px;
			word-wrap: break-word;
			line-height: 1.6;
			position: relative;
			box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
			transition: transform 0.2s, box-shadow 0.2s;
		}
		
		.message-content:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
		}
		
		.message.user .message-content {
			background: var(--primary-gradient);
			color: white;
			border-bottom-right-radius: 6px;
			box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
		}
		
		.message.user .message-content:hover {
			box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
		}
		
		.message.bot .message-content {
			background: white;
			color: #2d3748;
			border-bottom-left-radius: 6px;
			border: 1px solid rgba(0, 0, 0, 0.05);
		}
		
		.chat-input-container {
			padding: 25px 30px;
			background: white;
			border-top: 1px solid rgba(0, 0, 0, 0.05);
			display: flex;
			gap: 15px;
			align-items: center;
			backdrop-filter: blur(10px);
		}
		
		.chat-input {
			flex: 1;
			padding: 16px 24px;
			border: 2px solid #e2e8f0;
			border-radius: 30px;
			font-size: 16px;
			outline: none;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			background: #f8f9fa;
			font-family: 'Inter', sans-serif;
		}
		
		.chat-input:focus {
			border-color: #667eea;
			background: white;
			box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
			transform: translateY(-2px);
		}
		
		.send-button {
			padding: 16px 32px;
			background: var(--primary-gradient);
			color: white;
			border: none;
			border-radius: 30px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
			position: relative;
			overflow: hidden;
		}
		
		.send-button::before {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			width: 0;
			height: 0;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.3);
			transform: translate(-50%, -50%);
			transition: width 0.6s, height 0.6s;
		}
		
		.send-button:hover:not(:disabled)::before {
			width: 300px;
			height: 300px;
		}
		
		.send-button:hover:not(:disabled) {
			transform: translateY(-3px) scale(1.05);
			box-shadow: var(--shadow-hover);
		}
		
		.send-button:active:not(:disabled) {
			transform: translateY(-1px) scale(1.02);
		}
		
		.send-button:disabled {
			opacity: 0.6;
			cursor: not-allowed;
			transform: none;
		}
		
		.send-button span {
			position: relative;
			z-index: 1;
		}
		
		.loading {
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
		
		.loading-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: white;
			animation: loadingBounce 1.4s ease-in-out infinite;
		}
		
		.loading-dot:nth-child(1) { animation-delay: 0s; }
		.loading-dot:nth-child(2) { animation-delay: 0.2s; }
		.loading-dot:nth-child(3) { animation-delay: 0.4s; }
		
		@keyframes loadingBounce {
			0%, 80%, 100% {
				transform: scale(0);
				opacity: 0.5;
			}
			40% {
				transform: scale(1);
				opacity: 1;
			}
		}
		
		.welcome-message {
			text-align: center;
			color: #64748b;
			padding: 60px 20px;
			animation: welcomeFadeIn 1s ease-out;
		}
		
		@keyframes welcomeFadeIn {
			from {
				opacity: 0;
				transform: translateY(20px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
		
		.welcome-message h2 {
			margin-bottom: 15px;
			color: #1e293b;
			font-size: 32px;
			font-weight: 700;
			background: var(--primary-gradient);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		}
		
		.welcome-message p {
			font-size: 16px;
			line-height: 1.6;
		}
		
		.error-message {
			background: linear-gradient(135deg, #fee 0%, #fdd 100%);
			color: #c33;
			padding: 16px 20px;
			border-radius: 20px;
			margin-bottom: 15px;
			border-left: 4px solid #c33;
			animation: shake 0.5s;
		}
		
		@keyframes shake {
			0%, 100% { transform: translateX(0); }
			25% { transform: translateX(-10px); }
			75% { transform: translateX(10px); }
		}
		
		.upload-status {
			background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
			color: #1976d2;
			padding: 16px 20px;
			border-radius: 20px;
			margin-bottom: 15px;
			font-size: 14px;
			border-left: 4px solid #1976d2;
			animation: statusPulse 2s ease-in-out infinite;
		}
		
		@keyframes statusPulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.8; }
		}
		
		.message-content a {
			color: #667eea;
			text-decoration: none;
			border-bottom: 2px solid transparent;
			transition: all 0.3s;
		}
		
		.message-content a:hover {
			border-bottom-color: #667eea;
			color: #764ba2;
		}
		
		.message.user .message-content a {
			color: rgba(255, 255, 255, 0.9);
			border-bottom-color: rgba(255, 255, 255, 0.5);
		}
		
		.message.user .message-content a:hover {
			color: white;
			border-bottom-color: white;
		}
		
		/* Typing indicator */
		.typing-indicator {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 12px 16px;
		}
		
		.typing-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #667eea;
			animation: typingBounce 1.4s ease-in-out infinite;
		}
		
		.typing-dot:nth-child(1) { animation-delay: 0s; }
		.typing-dot:nth-child(2) { animation-delay: 0.2s; }
		.typing-dot:nth-child(3) { animation-delay: 0.4s; }
		
		@keyframes typingBounce {
			0%, 60%, 100% {
				transform: translateY(0);
				opacity: 0.7;
			}
			30% {
				transform: translateY(-10px);
				opacity: 1;
			}
		}
		
		/* Responsive design */
		@media (max-width: 768px) {
			.chat-container {
				height: 100vh;
				border-radius: 0;
			}
			
			.chat-header h1 {
				font-size: 22px;
			}
			
			.message-content {
				max-width: 85%;
			}
		}
	</style>
</head>
<body>
	<div class="chat-container">
		<div class="chat-header">
			<h1>✨ Danish Personal Assistant</h1>
		</div>
		<div class="chat-messages" id="chatMessages">
			<div class="welcome-message">
				<h2>Welcome!</h2>
				<p>Ask me anything or share links in your messages. I'll automatically extract and learn from any URLs you provide.</p>
			</div>
		</div>
		<div class="chat-input-container">
			<input 
				type="text" 
				id="chatInput" 
				class="chat-input" 
				placeholder="Type your message here..."
				autocomplete="off"
			/>
			<button id="sendButton" class="send-button">
				<span>Send</span>
			</button>
		</div>
	</div>
	
	<script>
		const chatMessages = document.getElementById('chatMessages');
		const chatInput = document.getElementById('chatInput');
		const sendButton = document.getElementById('sendButton');
		
		// Track conversation ID for maintaining context
		let conversationId = null;
		const userId = 'syed-danish-hussain';
		
		function addMessage(text, isUser) {
			const welcomeMessage = chatMessages.querySelector('.welcome-message');
			if (welcomeMessage) {
				welcomeMessage.remove();
			}
			
			const messageDiv = document.createElement('div');
			messageDiv.className = \`message \${isUser ? 'user' : 'bot'}\`;
			
			const contentDiv = document.createElement('div');
			contentDiv.className = 'message-content';
			
			// Detect and format URLs in the message
			const urlRegex = new RegExp('(https?://[^\\s]+)', 'g');
			const formattedText = text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
			
			const textNode = document.createElement('div');
			textNode.innerHTML = formattedText;
			contentDiv.appendChild(textNode);
			
			messageDiv.appendChild(contentDiv);
			chatMessages.appendChild(messageDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
		
		function addStatusMessage(text, isSuccess = true) {
			const statusDiv = document.createElement('div');
			statusDiv.className = isSuccess ? 'upload-status' : 'error-message';
			statusDiv.textContent = text;
			chatMessages.appendChild(statusDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
		
		function addLoadingMessage() {
			const messageDiv = document.createElement('div');
			messageDiv.className = 'message bot';
			messageDiv.id = 'loadingMessage';
			
			const contentDiv = document.createElement('div');
			contentDiv.className = 'message-content typing-indicator';
			contentDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
			
			messageDiv.appendChild(contentDiv);
			chatMessages.appendChild(messageDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
		
		function removeLoadingMessage() {
			const loadingMessage = document.getElementById('loadingMessage');
			if (loadingMessage) {
				loadingMessage.remove();
			}
		}
		
		function addErrorMessage(text) {
			const errorDiv = document.createElement('div');
			errorDiv.className = 'error-message';
			errorDiv.textContent = text;
			chatMessages.appendChild(errorDiv);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		}
		
		async function sendMessage() {
			const question = chatInput.value.trim();
			if (!question) return;
			
			// Add user message
			addMessage(question, true);
			chatInput.value = '';
			sendButton.disabled = true;
			
			// Add loading indicator
			addLoadingMessage();
			
			try {
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						text: question,
						conversationId: conversationId,
						userId: userId
					})
				});
				
				if (!response.ok) {
					throw new Error(\`Error: \${response.status}\`);
				}
				
				const result = await response.json();
				removeLoadingMessage();
				
				// Update conversation ID for next message
				if (result.conversationId) {
					conversationId = result.conversationId;
				}
				
				addMessage(result.response || result, false);
			} catch (error) {
				removeLoadingMessage();
				addErrorMessage(\`Failed to get response: \${error.message}\`);
			} finally {
				sendButton.disabled = false;
				chatInput.focus();
			}
		}
		
		// Event listeners
		sendButton.addEventListener('click', sendMessage);
		
		chatInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		});
		
		// Focus input on load
		chatInput.focus();
	</script>
</body>
</html>`);
});

// Helper function to extract URLs from text
function extractUrls(text) {
	const urlRegex = new RegExp('(https?://[^\\s]+)', 'g');
	return text.match(urlRegex) || [];
}

// Helper function to extract content from a URL
async function extractContentFromUrl(url, env) {
	try {
		// Validate URL
		let parsedUrl;
		try {
			parsedUrl = new URL(url);
		} catch {
			return null;
		}
		
		// Fetch content from URL
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; RAG-AI-Bot/1.0)'
			}
		});
		
		if (!response.ok) {
			return null;
		}
		
		const contentType = response.headers.get("content-type") || "";
		let extractedText = "";
		
		if (contentType.includes("text/html")) {
			// Extract text from HTML
			const html = await response.text();
			
			// Simple HTML text extraction (remove scripts, styles, etc.)
			let text = html
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			
			// Limit text length to avoid token limits
			extractedText = text.substring(0, 50000);
			
			if (!extractedText || extractedText.length < 100) {
				extractedText = `Content from ${url}. Web page processed.`;
			}
		} else if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
			extractedText = await response.text();
			// Limit text length
			extractedText = extractedText.substring(0, 50000);
		} else {
			// For other content types, create a basic description
			extractedText = `Content from ${url} (${contentType}). Link processed and added to knowledge base.`;
		}
		
		// Add metadata about this being information for Syed Danish Hussain
		extractedText = `[Personal Information for Syed Danish Hussain]\n[Content from: ${url}]\n${extractedText}`;
		
		// Process and add to knowledge base
		if (extractedText) {
			await env.RAG_WORKFLOW.create({ params: { text: extractedText } });
		}
		
		return extractedText.substring(0, 200) + (extractedText.length > 200 ? "..." : "");
	} catch (error) {
		console.error("Error extracting content from URL:", error);
		return null;
	}
}

// API endpoint for chat queries - now supports conversation history and automatic URL extraction
app.post("/api/chat", async (c) => {
	try {
		const { text, conversationId, userId = "syed-danish-hussain" } = await c.req.json();
		
		if (!text) {
			return c.json({ error: "Please provide a question" }, 400);
		}
		
		// Detect URLs in the message and extract content
		const urls = extractUrls(text);
		const extractedUrls = [];
		
		if (urls.length > 0) {
			for (const url of urls) {
				const summary = await extractContentFromUrl(url, c.env);
				if (summary) {
					extractedUrls.push({ url, summary });
				}
			}
		}

		// Get user information for personalization
		let userInfo = "";
		try {
			const userQuery = `SELECT * FROM user_info WHERE user_id = ? LIMIT 1`;
			const userResult = await c.env.DB.prepare(userQuery).bind(userId).first();
			if (userResult && userResult.info) {
				userInfo = userResult.info;
			}
		} catch (e) {
			console.log("User info not found, using default");
		}

		// Get conversation history
		let conversationHistory = [];
		if (conversationId) {
			try {
				const historyQuery = `SELECT role, content FROM conversation_history WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 10`;
				const historyResult = await c.env.DB.prepare(historyQuery).bind(conversationId).all();
				if (historyResult && historyResult.results) {
					conversationHistory = historyResult.results.map(row => ({
						role: row.role,
						content: row.content
					}));
				}
			} catch (e) {
				console.log("No conversation history found");
			}
		}

		// Generate embeddings for the question
		const embeddings = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", {
			text: text,
		});
		const vectors = embeddings.data[0];

		// Query vector index with more results for better context
		// Increase topK and use lower score threshold for better retrieval
		const vectorQuery = await c.env.VECTOR_INDEX.query(vectors, { topK: 10 });
		
		let notes = [];
		if (vectorQuery.matches && vectorQuery.matches.length > 0) {
			// Filter matches by score (include matches with reasonable similarity)
			// Lower threshold to catch more relevant content
			const relevantMatches = vectorQuery.matches.filter(match => 
				!match.score || match.score > 0.2  // Lower threshold for better recall
			);
			
			if (relevantMatches.length > 0) {
				const vecIds = relevantMatches.map(match => match.id);
				const placeholders = vecIds.map(() => '?').join(',');
				const query = `SELECT * FROM notes WHERE id IN (${placeholders})`;
				const { results } = await c.env.DB.prepare(query).bind(...vecIds).all();
				if (results) {
					notes = results.map((vec) => vec.text);
				}
			}
		}
		
		// If no vector matches but question is about resume/user info, try keyword search as fallback
		if (notes.length === 0 && (text.toLowerCase().includes('resume') || text.toLowerCase().includes('about me') || text.toLowerCase().includes('understand') || text.toLowerCase().includes('danish'))) {
			try {
				const keywordQuery = `SELECT * FROM notes WHERE text LIKE ? OR text LIKE ? OR text LIKE ? LIMIT 10`;
				const keywordResults = await c.env.DB.prepare(keywordQuery)
					.bind('%resume%', '%Danish%', '%Syed Danish Hussain%')
					.all();
				if (keywordResults && keywordResults.results && keywordResults.results.length > 0) {
					notes = keywordResults.results.map((vec) => vec.text);
				}
			} catch (e) {
				console.log("Keyword search error:", e);
			}
		}

		const contextMessage = notes.length
			? `Relevant Context from Knowledge Base:\n${notes.map((note, idx) => `${idx + 1}. ${note.substring(0, 500)}${note.length > 500 ? '...' : ''}`).join("\n")}`
			: "";

		// Personalized system prompt
		const personalization = userInfo 
			? `You are a personalized AI assistant for Syed Danish Hussain. Here is information about Syed Danish Hussain:\n${userInfo}\n\n`
			: `You are a personalized AI assistant for Syed Danish Hussain. `;
		
		const systemPrompt = `${personalization}When answering questions, use the context provided from the knowledge base if it is relevant. Remember previous parts of the conversation and maintain context. Be helpful, accurate, and personalized. If the context doesn't contain relevant information, say so but still try to be helpful.`;

		// Build messages array with history
		const messages = [];
		
		// Add system message with context
		const systemContent = [systemPrompt];
		if (contextMessage) {
			systemContent.push(contextMessage);
		}
		messages.push({
			role: "system",
			content: systemContent.filter(Boolean).join("\n\n")
		});

		// Add conversation history
		conversationHistory.forEach(msg => {
			messages.push({
				role: msg.role,
				content: msg.content
			});
		});

		// Add current question
		messages.push({ role: "user", content: text });

		let modelUsed = "";
		let response = null;

		if (c.env.MISTRAL_API_KEY) {
			const mistral = new Mistral({
				apiKey: c.env.MISTRAL_API_KEY,
			});

			const model = "mistral-large-latest";
			modelUsed = model;

			const message = await mistral.chat.complete({
				model,
				messages: messages,
				maxTokens: 2048,
			});

			response = {
				response: message.choices[0]?.message?.content || "",
			};
		} else {
			const model = "@cf/meta/llama-3.1-8b-instruct";
			modelUsed = model;

			response = await c.env.AI.run(model, {
				messages: messages,
			});
		}

		// Store conversation in history
		const newConversationId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		try {
			// Store user message
			await c.env.DB.prepare(
				`INSERT INTO conversation_history (conversation_id, user_id, role, content) VALUES (?, ?, ?, ?)`
			).bind(newConversationId, userId, "user", text).run();
			
			// Store assistant response
			await c.env.DB.prepare(
				`INSERT INTO conversation_history (conversation_id, user_id, role, content) VALUES (?, ?, ?, ?)`
			).bind(newConversationId, userId, "assistant", response.response).run();
		} catch (e) {
			console.error("Error storing conversation:", e);
		}

		// Build response message
		let responseMessage = response.response;
		
		// Add information about extracted URLs if any
		if (extractedUrls.length > 0) {
			const urlInfo = extractedUrls.map(u => `✅ Extracted and learned from: ${u.url}`).join('\n');
			responseMessage = `${urlInfo}\n\n${responseMessage}`;
		}
		
		if (response) {
			c.header("x-model-used", modelUsed);
			return c.json({
				response: responseMessage,
				conversationId: newConversationId,
				contextUsed: notes.length > 0,
				urlsExtracted: extractedUrls.length
			});
		} else {
			return c.json({ error: "We were unable to generate output" }, 500);
		}
	} catch (error) {
		console.error("Chat error:", error);
		return c.json({ error: error.message || "Failed to process chat" }, 500);
	}
});

// Keep GET endpoint for backward compatibility
app.get("/api/chat", async (c) => {
	const question = c.req.query("text");
	if (!question) {
		return c.text("Please provide a question using the ?text= parameter", 400);
	}
	
	// Redirect to POST endpoint
	const response = await fetch(new URL("/api/chat", c.req.url).toString(), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text: question })
	});
	
	return c.text(await response.text());
});

// API endpoint to store/update user information
app.post("/api/user-info", async (c) => {
	try {
		const { userId = "syed-danish-hussain", info } = await c.req.json();
		
		if (!info) {
			return c.json({ error: "User information is required" }, 400);
		}
		
		// Store or update user information (SQLite compatible)
		try {
			await c.env.DB.prepare(
				`INSERT INTO user_info (user_id, info, updated_at) VALUES (?, ?, datetime('now'))`
			).bind(userId, info).run();
		} catch (e) {
			// If user exists, update instead
			await c.env.DB.prepare(
				`UPDATE user_info SET info = ?, updated_at = datetime('now') WHERE user_id = ?`
			).bind(info, userId).run();
		}
		
		return c.json({ 
			success: true, 
			message: "User information updated successfully" 
		});
	} catch (error) {
		return c.json({ error: error.message || "Failed to update user information" }, 500);
	}
});

app.post("/notes", async (c) => {
	const { text } = await c.req.json();
	if (!text) return c.text("Missing text", 400);
	await c.env.RAG_WORKFLOW.create({ params: { text } });
	return c.text("Created note", 201);
});

app.delete("/notes/:id", async (c) => {
	const { id } = c.req.param();

	const query = `DELETE FROM notes WHERE id = ?`;
	await c.env.DB.prepare(query).bind(id).run();

	await c.env.VECTOR_INDEX.deleteByIds([id]);

	return c.status(204);
});

app.onError((err, c) => {
	return c.text(err);
});

export default app;
