<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Type definitions
	interface HistoryItem {
		expression: string;
		result: number;
	}

	let expression: string = $state('');
	let result: string = $state('');
	let history: HistoryItem[] = $state([]);
	let inputElement: HTMLInputElement | undefined = $state();
	let isError: boolean = $state(false);
	let isMobile: boolean = $state(false);
	let historyLoaded: boolean = $state(false);

	// Detect mobile device
	onMount(() => {
		loadFromUrl();
		loadHistoryFromStorage();
		// Simple mobile detection
		isMobile =
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			window.innerWidth <= 768;
	});

	// URL parameter sync
	function updateUrl() {
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams($page.url.searchParams);

			if (expression.trim()) {
				params.set('expression', expression);
			} else {
				params.delete('expression');
			}

			goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
		}
	}

	function loadFromUrl() {
		const urlExpression = $page.url.searchParams.get('expression');
		if (urlExpression) {
			expression = urlExpression;
			evaluateExpression();
		}
	}

	// History persistence
	function loadHistoryFromStorage() {
		if (typeof window !== 'undefined') {
			try {
				const storedHistory = localStorage.getItem('calculator-history');
				if (storedHistory) {
					history = JSON.parse(storedHistory);
				}
			} catch (error) {
				console.warn('Failed to load history from localStorage:', error);
				history = [];
			}
			historyLoaded = true;
		}
	}

	function saveHistoryToStorage() {
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('calculator-history', JSON.stringify(history));
			} catch (error) {
				console.warn('Failed to save history to localStorage:', error);
			}
		}
	}

	// Watch for history changes and save to localStorage
	$effect(() => {
		if (typeof window !== 'undefined' && history && historyLoaded) {
			saveHistoryToStorage();
		}
	});

	// Watch for expression changes and update URL
	$effect(() => {
		if (typeof window !== 'undefined' && expression !== undefined) {
			updateUrl();
		}
	});

	// Evaluate mathematical expressions with proper operator precedence
	function evaluateExpression() {
		if (!expression.trim()) {
			result = '';
			isError = false;
			return;
		}

		try {
			// Replace common symbols with JS-friendly operators
			let cleanExpression = expression
				.replace(/×/g, '*')
				.replace(/÷/g, '/')
				.replace(/−/g, '-')
				.replace(/[^\d+\-*/().\s]/g, ''); // Remove any non-mathematical characters

			// Basic security check - only allow numbers, operators, and parentheses
			if (!/^[\d+\-*/().\s]+$/.test(cleanExpression)) {
				throw new Error('Invalid characters in expression');
			}

			// Evaluate the expression safely
			const evaluated = Function(`"use strict"; return (${cleanExpression})`)();

			if (isNaN(evaluated) || !isFinite(evaluated)) {
				throw new Error('Invalid calculation');
			}

			result = formatResult(evaluated);
			isError = false;

			// Add to history if it's a complete calculation
			if (cleanExpression && !isError) {
				const historyItem: HistoryItem = {
					expression: expression.trim(),
					result: evaluated
				};

				// Avoid duplicates
				if (history.length === 0 || history[history.length - 1].expression !== expression.trim()) {
					history = [...history, historyItem];
					// Keep only last 20 items
					if (history.length > 20) {
						history = history.slice(-20);
					}
				}
			}
		} catch (_error) {
			result = 'Error';
			isError = true;
		}
	}

	function formatResult(value: number): string {
		// Handle very large or very small numbers
		if (Math.abs(value) >= 1e9 || (Math.abs(value) < 1e-6 && value !== 0)) {
			return value.toExponential(5);
		}

		// Format with appropriate decimal places
		if (value % 1 === 0) {
			return value.toLocaleString();
		} else {
			return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
		}
	}

	function handleInput() {
		evaluateExpression();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			evaluateExpression();
		} else if (event.key === 'Escape') {
			clearAll();
		}
	}

	function insertText(text: string) {
		const cursorPos = inputElement?.selectionStart ?? expression.length;
		expression = expression.slice(0, cursorPos) + text + expression.slice(cursorPos);
		// Only set cursor position, don't force focus to prevent jumping
		setTimeout(() => {
			if (inputElement && document.activeElement === inputElement) {
				inputElement.setSelectionRange(cursorPos + text.length, cursorPos + text.length);
			}
		}, 0);
		evaluateExpression();
	}

	function insertNumber(num: string) {
		insertText(num);
	}

	function backspace() {
		if (expression.length > 0) {
			const cursorPos = inputElement?.selectionStart ?? expression.length;
			if (cursorPos > 0) {
				expression = expression.slice(0, cursorPos - 1) + expression.slice(cursorPos);
				setTimeout(() => {
					if (inputElement && document.activeElement === inputElement) {
						inputElement.setSelectionRange(cursorPos - 1, cursorPos - 1);
					}
				}, 0);
				evaluateExpression();
			}
		}
	}

	function clearAll() {
		expression = '';
		result = '';
		isError = false;
		// Only focus if user was already in the input
		if (inputElement && document.activeElement === inputElement) {
			inputElement.focus();
		}
	}

	function useHistoryItem(item: HistoryItem) {
		expression = item.expression;
		evaluateExpression();
		// Only focus if input is visible and user clicked on history
		if (inputElement && !isMobile) {
			inputElement.focus();
		}
	}

	function deleteHistoryItem(index: number) {
		history = history.filter((_, i) => i !== index);
		saveHistoryToStorage();
	}

	function clearAllHistory() {
		history = [];
		saveHistoryToStorage();
	}
</script>

<div class="calculator">
	<!-- Main Input and Display -->
	<div class="input-section">
		<div class="input-container">
			<input
				bind:this={inputElement}
				bind:value={expression}
				oninput={handleInput}
				onkeydown={handleKeydown}
				placeholder="Enter expression like: 1 + 2 * 5 - 2"
				class="expression-input"
				type="text"
				autocomplete="off"
				inputmode={isMobile ? 'none' : 'text'}
				readonly={isMobile}
			/>
			<button
				class="clear-button"
				onclick={clearAll}
				title="Clear (Esc)"
				aria-label="Clear expression"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		{#if result}
			<div class="result-container" class:error={isError}>
				<span class="equals">=</span>
				<span class="result">{result}</span>
			</div>
		{/if}
	</div>

	<!-- Desktop: Quick Action Buttons Only -->
	{#if !isMobile}
		<div class="actions">
			<button class="action-btn" onclick={() => insertText('+')} title="Add">
				<span>+</span>
			</button>
			<button class="action-btn" onclick={() => insertText('-')} title="Subtract">
				<span>−</span>
			</button>
			<button class="action-btn" onclick={() => insertText('*')} title="Multiply">
				<span>×</span>
			</button>
			<button class="action-btn" onclick={() => insertText('/')} title="Divide">
				<span>÷</span>
			</button>
			<button class="action-btn" onclick={() => insertText('(')} title="Open parenthesis">
				<span>(</span>
			</button>
			<button class="action-btn" onclick={() => insertText(')')} title="Close parenthesis">
				<span>)</span>
			</button>
			<button class="action-btn" onclick={() => insertText('**')} title="Power">
				<span>^</span>
			</button>
			<button class="action-btn" onclick={() => insertText('.')} title="Decimal">
				<span>.</span>
			</button>
		</div>
	{/if}

	<!-- Mobile: Full Number Pad -->
	{#if isMobile}
		<div class="number-pad">
			<div class="number-row">
				<button class="number-btn" onclick={() => insertNumber('7')}>7</button>
				<button class="number-btn" onclick={() => insertNumber('8')}>8</button>
				<button class="number-btn" onclick={() => insertNumber('9')}>9</button>
				<button class="number-btn operator" onclick={() => insertText('/')}>÷</button>
			</div>
			<div class="number-row">
				<button class="number-btn" onclick={() => insertNumber('4')}>4</button>
				<button class="number-btn" onclick={() => insertNumber('5')}>5</button>
				<button class="number-btn" onclick={() => insertNumber('6')}>6</button>
				<button class="number-btn operator" onclick={() => insertText('*')}>×</button>
			</div>
			<div class="number-row">
				<button class="number-btn" onclick={() => insertNumber('1')}>1</button>
				<button class="number-btn" onclick={() => insertNumber('2')}>2</button>
				<button class="number-btn" onclick={() => insertNumber('3')}>3</button>
				<button class="number-btn operator" onclick={() => insertText('-')}>−</button>
			</div>
			<div class="number-row">
				<button class="number-btn wide" onclick={() => insertNumber('0')}>0</button>
				<button class="number-btn" onclick={() => insertText('.')}>.</button>
				<button class="number-btn operator" onclick={() => insertText('+')}>+</button>
			</div>
			<div class="number-row">
				<button
					class="number-btn function"
					onclick={() => insertText('(')}
					title="Open parenthesis"
				>
					<span>(</span>
				</button>
				<button
					class="number-btn function"
					onclick={() => insertText(')')}
					title="Close parenthesis"
				>
					<span>)</span>
				</button>
				<button class="number-btn function" onclick={backspace} aria-label="Backspace">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M9 9l6 6m0-6l-6 6M21 12H3" />
					</svg>
				</button>
				<button class="number-btn function" onclick={() => insertText('**')} title="Power">
					<span>^</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- History -->
	{#if history.length > 0}
		<div class="history-section">
			<div class="history-header">
				<h3>Recent Calculations</h3>
				<button
					class="clear-history-btn"
					onclick={clearAllHistory}
					title="Clear all history"
					aria-label="Clear all history"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
						/>
					</svg>
				</button>
			</div>
			<div class="history-items">
				{#each history.slice(-5).reverse() as item, index (`${item.expression}-${item.result}`)}
					<div class="history-item">
						<button class="history-content" onclick={() => useHistoryItem(item)}>
							<span class="history-expression">{item.expression}</span>
							<span class="history-result">= {formatResult(item.result)}</span>
						</button>
						<button
							class="delete-history-btn"
							onclick={() => deleteHistoryItem(history.length - 1 - index)}
							title="Delete this calculation"
							aria-label="Delete this calculation"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.calculator {
		max-width: 500px;
		margin: 0 auto;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 20px;
		padding: 20px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
		color: white;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	.input-section {
		margin-bottom: 20px;
	}

	.input-container {
		position: relative;
		display: flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 4px;
		backdrop-filter: blur(10px);
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.expression-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		padding: 16px 20px;
		font-size: 20px;
		color: white;
		font-weight: 500;
		letter-spacing: 0.5px;
		cursor: text;
	}

	.expression-input[readonly] {
		cursor: pointer;
	}

	.expression-input::placeholder {
		color: rgba(255, 255, 255, 0.6);
		font-weight: 400;
	}

	.clear-button {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		border-radius: 12px;
		padding: 10px;
		margin-right: 6px;
		cursor: pointer;
		color: white;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clear-button:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: scale(1.05);
	}

	.result-container {
		margin-top: 12px;
		padding: 16px 20px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		display: flex;
		align-items: center;
		gap: 12px;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.result-container.error {
		background: rgba(255, 107, 107, 0.2);
		border-color: rgba(255, 107, 107, 0.4);
	}

	.equals {
		font-size: 24px;
		font-weight: 300;
		opacity: 0.8;
	}

	.result {
		font-size: 28px;
		font-weight: 600;
		letter-spacing: 0.5px;
		flex: 1;
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 20px;
	}

	.action-btn {
		background: rgba(255, 255, 255, 0.15);
		border: none;
		border-radius: 12px;
		padding: 14px;
		cursor: pointer;
		color: white;
		font-size: 18px;
		font-weight: 600;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
	}

	.action-btn:active {
		transform: translateY(0);
	}

	/* Number Pad Styles */
	.number-pad {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		padding: 16px;
		margin-bottom: 20px;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.number-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 10px;
	}

	.number-row:last-child {
		margin-bottom: 0;
	}

	.number-btn {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		border-radius: 12px;
		padding: 16px;
		cursor: pointer;
		color: white;
		font-size: 20px;
		font-weight: 600;
		transition: all 0.2s ease;
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 50px;
	}

	.number-btn:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
	}

	.number-btn:active {
		transform: translateY(0);
	}

	.number-btn.wide {
		grid-column: span 2;
	}

	.number-btn.operator {
		background: rgba(255, 255, 255, 0.25);
		font-weight: 700;
	}

	.number-btn.operator:hover {
		background: rgba(255, 255, 255, 0.35);
	}

	.number-btn.function {
		background: rgba(255, 255, 255, 0.15);
		font-size: 16px;
	}

	.number-btn.function:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.history-section {
		margin-top: 20px;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.history-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		opacity: 0.9;
	}

	.clear-history-btn {
		background: rgba(255, 107, 107, 0.2);
		border: none;
		border-radius: 8px;
		padding: 6px;
		cursor: pointer;
		color: white;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 107, 107, 0.3);
	}

	.clear-history-btn:hover {
		background: rgba(255, 107, 107, 0.3);
		transform: scale(1.05);
	}

	.history-items {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		padding: 3px;
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.2s ease;
	}

	.history-item:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}

	.history-content {
		flex: 1;
		background: transparent;
		border: none;
		cursor: pointer;
		color: white;
		display: flex;
		justify-content: space-between;
		align-items: center;
		text-align: left;
		padding: 10px 12px;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.history-content:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.history-expression {
		font-size: 13px;
		opacity: 0.9;
		font-weight: 400;
	}

	.history-result {
		font-size: 13px;
		font-weight: 600;
		opacity: 0.8;
	}

	.delete-history-btn {
		background: rgba(255, 107, 107, 0.2);
		border: none;
		border-radius: 8px;
		padding: 6px;
		cursor: pointer;
		color: white;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 107, 107, 0.3);
		margin-right: 3px;
	}

	.delete-history-btn:hover {
		background: rgba(255, 107, 107, 0.4);
		transform: scale(1.1);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.calculator {
			margin: 10px;
			padding: 16px;
			max-width: none;
		}

		.expression-input {
			font-size: 18px;
			padding: 14px 16px;
		}

		.result {
			font-size: 24px;
		}

		.number-btn {
			padding: 14px;
			font-size: 18px;
			min-height: 45px;
		}
	}

	@media (max-width: 480px) {
		.calculator {
			padding: 12px;
		}

		.expression-input {
			font-size: 16px;
			padding: 12px 14px;
		}

		.result {
			font-size: 20px;
		}

		.number-btn {
			padding: 12px;
			font-size: 16px;
			min-height: 40px;
		}

		.history-expression,
		.history-result {
			font-size: 11px;
		}
	}
</style>
