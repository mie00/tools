<script lang="ts">
	// Type definitions
	interface HistoryItem {
		expression: string;
		result: number;
	}

	let display: string = '0';
	let previousValue: number | null = null;
	let operation: string | null = null;
	let waitingForOperand: boolean = false;
	let shouldResetDisplay: boolean = false;
	let history: HistoryItem[] = [];

	let currentExpression: string = '';
	let lastCalculation = '';

	// Format display number with proper spacing and commas
	function formatDisplay(value: string): string {
		if (value === 'Error') return value;

		const num = parseFloat(value);
		if (isNaN(num)) return value;

		// Handle very large or very small numbers with scientific notation
		if (Math.abs(num) >= 1e9 || (Math.abs(num) < 1e-6 && num !== 0)) {
			return num.toExponential(5);
		}

		// Format with commas for thousands
		const parts = num.toString().split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
		return parts.join('.');
	}

	function updateExpression() {
		if (previousValue !== null && operation) {
			if (waitingForOperand) {
				// Just show "9 +" when waiting for the next operand
				currentExpression = `${formatDisplay(String(previousValue))} ${operation}`;
			} else {
				// Show "9 + 5" when the second operand is being entered
				currentExpression = `${formatDisplay(String(previousValue))} ${operation} ${display.replace(/,/g, '')}`;
			}
		} else if (display !== '0') {
			currentExpression = display.replace(/,/g, '');
		} else {
			currentExpression = '';
		}
	}

	function inputNumber(num: string) {
		if (waitingForOperand || shouldResetDisplay) {
			display = String(num);
			waitingForOperand = false;
			shouldResetDisplay = false;
			lastCalculation = '';
		} else {
			if (display.replace(/,/g, '').length < 9) {
				// Limit to 9 digits like Apple
				display = display === '0' ? String(num) : display.replace(/,/g, '') + num;
			}
		}
		updateExpression();
	}

	function inputDecimal() {
		if (waitingForOperand || shouldResetDisplay) {
			display = '0.';
			waitingForOperand = false;
			shouldResetDisplay = false;
			lastCalculation = '';
		} else if (display.replace(/,/g, '').indexOf('.') === -1) {
			display = display.replace(/,/g, '') + '.';
		}
		updateExpression();
	}

	function clear() {
		display = '0';
		previousValue = null;
		operation = null;
		waitingForOperand = false;
		shouldResetDisplay = false;
		currentExpression = '';
		lastCalculation = '';
	}

	function allClear() {
		clear();
		history = [];
	}

	function toggleSign() {
		const num = parseFloat(display.replace(/,/g, ''));
		if (!isNaN(num) && num !== 0) {
			display = String(-num);
		}
		updateExpression();
	}

	function percentage() {
		const num = parseFloat(display.replace(/,/g, ''));
		if (!isNaN(num)) {
			display = String(num / 100);
			shouldResetDisplay = true;
		}
		updateExpression();
	}

	function performOperation(nextOperation: string) {
		const inputValue = parseFloat(display.replace(/,/g, ''));

		if (previousValue === null) {
			previousValue = inputValue;
		} else if (operation && !waitingForOperand) {
			const currentValue = previousValue || 0;
			const newValue = calculate(currentValue, inputValue, operation);

			// Add to history
			history = [
				...history,
				{
					expression: `${currentValue} ${operation} ${inputValue}`,
					result: newValue
				}
			];

			if (isNaN(newValue) || !isFinite(newValue)) {
				display = 'Error';
				previousValue = null;
				operation = null;
				shouldResetDisplay = true;
				currentExpression = '';
				lastCalculation = '';
				return;
			}

			display = String(newValue);
			previousValue = newValue;
		}

		waitingForOperand = true;
		operation = nextOperation;
		updateExpression();
	}

	function calculate(firstValue: number, secondValue: number, operation: string): number {
		switch (operation) {
			case '+':
				return firstValue + secondValue;
			case '−':
				return firstValue - secondValue;
			case '×':
				return firstValue * secondValue;
			case '÷':
				return secondValue !== 0 ? firstValue / secondValue : NaN;
			case '=':
				return secondValue;
			default:
				return secondValue;
		}
	}

	function handleEquals() {
		const inputValue = parseFloat(display.replace(/,/g, ''));

		if (previousValue !== null && operation) {
			const expression = `${formatDisplay(String(previousValue))} ${operation} ${formatDisplay(String(inputValue))}`;
			const newValue = calculate(previousValue, inputValue, operation);

			// Add to history
			history = [
				...history,
				{
					expression: `${previousValue} ${operation} ${inputValue}`,
					result: newValue
				}
			];

			if (isNaN(newValue) || !isFinite(newValue)) {
				display = 'Error';
				lastCalculation = '';
			} else {
				display = String(newValue);
				lastCalculation = expression;
			}

			previousValue = null;
			operation = null;
			waitingForOperand = true;
			shouldResetDisplay = true;
			currentExpression = '';
		}
	}

	// Get the appropriate clear button text
	$: clearButtonText = display !== '0' || previousValue !== null ? 'C' : 'AC';

	function handleClear() {
		if (clearButtonText === 'AC') {
			allClear();
		} else {
			clear();
		}
	}
</script>

<div class="calculator">
	<!-- Display -->
	<div class="display">
		{#if lastCalculation}
			<div class="expression-text">
				{lastCalculation}
			</div>
		{:else if currentExpression}
			<div class="expression-text">
				{currentExpression}
			</div>
		{/if}
		<div class="display-text">
			{formatDisplay(display)}
		</div>
	</div>

	<!-- Button Grid -->
	<div class="button-grid">
		<!-- Row 1 -->
		<button class="button function" on:click={handleClear}>
			{clearButtonText}
		</button>
		<button class="button function" on:click={toggleSign}> ± </button>
		<button class="button function" on:click={percentage}> % </button>
		<button class="button operator" on:click={() => performOperation('÷')}> ÷ </button>

		<!-- Row 2 -->
		<button class="button number" on:click={() => inputNumber('7')}> 7 </button>
		<button class="button number" on:click={() => inputNumber('8')}> 8 </button>
		<button class="button number" on:click={() => inputNumber('9')}> 9 </button>
		<button class="button operator" on:click={() => performOperation('×')}> × </button>

		<!-- Row 3 -->
		<button class="button number" on:click={() => inputNumber('4')}> 4 </button>
		<button class="button number" on:click={() => inputNumber('5')}> 5 </button>
		<button class="button number" on:click={() => inputNumber('6')}> 6 </button>
		<button class="button operator" on:click={() => performOperation('−')}> − </button>

		<!-- Row 4 -->
		<button class="button number" on:click={() => inputNumber('1')}> 1 </button>
		<button class="button number" on:click={() => inputNumber('2')}> 2 </button>
		<button class="button number" on:click={() => inputNumber('3')}> 3 </button>
		<button class="button operator" on:click={() => performOperation('+')}> + </button>

		<!-- Row 5 -->
		<button class="button number zero" on:click={() => inputNumber('0')}> 0 </button>
		<button class="button number" on:click={inputDecimal}> . </button>
		<button class="button operator" on:click={handleEquals}> = </button>
	</div>
</div>

<style>
	.calculator {
		width: 320px;
		background: #000;
		border-radius: 20px;
		padding: 20px;
		margin: 0 auto;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
	}

	.display {
		background: #000;
		color: white;
		text-align: right;
		padding: 20px 10px;
		margin-bottom: 20px;
		min-height: 100px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		overflow: hidden;
	}

	.expression-text {
		font-size: 20px;
		font-weight: 300;
		color: #666;
		margin-bottom: 8px;
		min-height: 24px;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.display-text {
		font-size: 64px;
		font-weight: 200;
		line-height: 1;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.button-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 12px;
	}

	.button {
		height: 70px;
		border: none;
		border-radius: 35px;
		font-size: 32px;
		font-weight: 400;
		cursor: pointer;
		transition: all 0.1s ease;
		outline: none;
		user-select: none;
		-webkit-user-select: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.button:active {
		transform: scale(0.95);
	}

	.button.number {
		background: #333;
		color: white;
	}

	.button.number:hover {
		background: #404040;
	}

	.button.function {
		background: #a6a6a6;
		color: black;
	}

	.button.function:hover {
		background: #bfbfbf;
	}

	.button.operator {
		background: #ff9500;
		color: white;
	}

	.button.operator:hover {
		background: #ffad33;
	}

	.button.zero {
		grid-column: span 2;
		padding-left: 25px;
		justify-content: flex-start;
	}

	/* Responsive text sizing */
	@media (max-width: 360px) {
		.calculator {
			width: 280px;
			padding: 15px;
		}

		.display-text {
			font-size: 48px;
		}

		.expression-text {
			font-size: 16px;
		}

		.button {
			height: 60px;
			font-size: 28px;
		}
	}
</style>
