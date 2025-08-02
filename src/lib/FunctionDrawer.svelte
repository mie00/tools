<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { T } from '$lib';
	import { StorageFactory } from '$lib/storage-api';

	// Initialize function drawer settings storage
	const functionDrawerStorage = StorageFactory.createFunctionDrawerSettingsStorage();

	let pyodide: any;
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let expression = $state('a * sin(x) + b');
	let variables: Record<string, number> = $state({});
	let extractedVars: string[] = $state([]);
	let isLoading = $state(false);
	let error = $state('');
	let xMin = $state(-10);
	let xMax = $state(10);
	let yMin = $state(-10);
	let yMax = $state(10);
	let resolution = $state(500);
	let showPresets = $state(false);

	// Animation state
	let hasTimeVariable = $state(false);
	let tmin = $state(0);
	let tmax = $state(6.28); // 2π
	let speed = $state(1); // cycles per second
	let isAnimating = $state(false);
	let animationId: number | null = null;
	let animationStartTime = 0;

	// Canvas interaction state
	let isDragging = $state(false);
	let dragMode: 'pan' | 'zoom' = $state('pan');
	let dragStart = { x: 0, y: 0 };
	let dragStartView = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
	let lastTouchDistance = 0;
	let isZooming = false;
	let lastCanvasTouchTime = 0;
	let canvasTouchCount = 0;
	let lastCanvasClickTime = 0;
	let canvasClickCount = 0;

	// Variable drag state
	let variableDragState: {
		isDragging: boolean;
		variable: string;
		startValue: number;
		startX: number;
		isExponential: boolean;
		lastTouchTime: number;
		touchCount: number;
	} = {
		isDragging: false,
		variable: '',
		startValue: 0,
		startX: 0,
		isExponential: false,
		lastTouchTime: 0,
		touchCount: 0
	};

	// History state
	interface HistoryEntry {
		id: string;
		name: string;
		expression: string;
		variables: Record<string, number>;
		timestamp: number;
	}

	let history: HistoryEntry[] = $state([]);
	let currentHistoryId: string | null = $state(null);
	let showHistory = $state(false);
	let isLoadingFromHistory = $state(false);

	// History management functions
	function generateHistoryId(): string {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	function createHistoryEntry(name?: string): HistoryEntry {
		const trimmedExpression = expression.trim();
		return {
			id: generateHistoryId(),
			name: name || trimmedExpression || 'Untitled Function',
			expression: trimmedExpression,
			variables: { ...variables },
			timestamp: Date.now()
		};
	}

	function addToHistory(entry: HistoryEntry) {
		history = [...history, entry];
		currentHistoryId = entry.id;
		// Keep only last 50 entries to prevent memory issues
		if (history.length > 50) {
			history = history.slice(-50);
		}
		// Save to storage API
		saveHistoryToStorage().catch((e) => console.warn('Failed to save history:', e));
	}

	function updateHistoryEntry(id: string, updates: Partial<HistoryEntry>) {
		history = history.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry));
		// Save to storage API
		saveHistoryToStorage().catch((e) => console.warn('Failed to save history:', e));
	}

	function removeHistoryEntry(id: string) {
		history = history.filter((entry) => entry.id !== id);
		if (currentHistoryId === id) {
			currentHistoryId = null;
		}
		// Save to storage API
		saveHistoryToStorage().catch((e) => console.warn('Failed to save history:', e));
	}

	// Storage API functions
	async function saveHistoryToStorage() {
		if (browser) {
			try {
				await functionDrawerStorage.setHistory(history, currentHistoryId || '');
			} catch (e) {
				console.warn('Failed to save history to storage:', e);
			}
		}
	}

	async function loadHistoryFromStorage() {
		if (browser) {
			try {
				const { history: savedHistory, currentId: savedCurrentId } =
					await functionDrawerStorage.getHistory();

				if (savedHistory && Array.isArray(savedHistory)) {
					history = savedHistory;
				}

				if (savedCurrentId) {
					currentHistoryId = savedCurrentId || null;
				}
			} catch (e) {
				console.warn('Failed to load history from storage:', e);
			}
		}
	}

	function loadHistoryEntry(entry: HistoryEntry) {
		isLoadingFromHistory = true;

		// Stop current animation
		stopAnimation();

		expression = entry.expression;
		variables = { ...entry.variables };
		currentHistoryId = entry.id;

		// Parse and redraw
		if (pyodide && !isLoading) {
			parseExpression();
			setTimeout(() => {
				drawFunction();
				isLoadingFromHistory = false;
			}, 100);
		} else {
			isLoadingFromHistory = false;
		}
	}

	function checkpointCurrent() {
		const entry = createHistoryEntry();
		addToHistory(entry);
	}

	function isValidExpression(expr: string): boolean {
		if (!pyodide || !expr.trim()) return false;

		try {
			const pythonCode = `
import ast
try:
    ast.parse("${expr.trim()}", mode='eval')
    result = True
except:
    result = False
result
			`;
			const result = pyodide.runPython(pythonCode);
			return result === true;
		} catch (_e) {
			return false;
		}
	}

	function handleHistoryUpdate() {
		if (isLoadingFromHistory) return;

		const trimmedExpression = expression.trim();

		// Only store valid expressions
		if (!isValidExpression(trimmedExpression)) {
			return;
		}

		const lastEntry = history[history.length - 1];

		// If last entry has same expression, just update the variables
		if (lastEntry && lastEntry.expression === trimmedExpression) {
			updateHistoryEntry(lastEntry.id, {
				variables: { ...variables },
				timestamp: Date.now()
			});
			currentHistoryId = lastEntry.id;
		} else {
			// Different expression, add new entry
			const entry = createHistoryEntry();
			addToHistory(entry);
		}
	}

	// Rename entry state
	let renamingEntryId: string | null = $state(null);
	let renameValue = $state('');

	function startRename(entry: HistoryEntry) {
		renamingEntryId = entry.id;
		renameValue = entry.name;
	}

	function finishRename() {
		if (renamingEntryId && renameValue.trim()) {
			updateHistoryEntry(renamingEntryId, { name: renameValue.trim() });
		}
		renamingEntryId = null;
		renameValue = '';
	}

	function cancelRename() {
		renamingEntryId = null;
		renameValue = '';
	}

	// Preset functions
	const presetFunctions = [
		{ name: 'Linear', expression: 'a * x + b', vars: { a: 1, b: 0 } },
		{ name: 'Quadratic', expression: 'a * x**2 + b * x + c', vars: { a: 1, b: 0, c: 0 } },
		{ name: 'Sine Wave', expression: 'a * sin(b * x + c) + d', vars: { a: 1, b: 1, c: 0, d: 0 } },
		{ name: 'Cosine Wave', expression: 'a * cos(b * x + c) + d', vars: { a: 1, b: 1, c: 0, d: 0 } },
		{ name: 'Exponential', expression: 'a * exp(b * x)', vars: { a: 1, b: 1 } },
		{ name: 'Logarithm', expression: 'a * log(abs(x)) + b', vars: { a: 1, b: 0 } },
		{ name: 'Tangent', expression: 'a * tan(b * x)', vars: { a: 1, b: 1 } },
		{
			name: 'Polynomial',
			expression: 'a * x**3 + b * x**2 + c * x + d',
			vars: { a: 1, b: 0, c: 0, d: 0 }
		},
		{
			name: 'Gaussian',
			expression: 'a * exp(-((x - b)**2) / (2 * c**2))',
			vars: { a: 1, b: 0, c: 1 }
		},
		{ name: 'Hyperbola', expression: 'a / (x - b) + c', vars: { a: 1, b: 0, c: 0 } },
		{ name: 'Animated Wave', expression: 'a * sin(b * x + c * t)', vars: { a: 1, b: 1, c: 2 } },
		{ name: 'Traveling Wave', expression: 'a * sin(b * (x - c * t))', vars: { a: 1, b: 1, c: 1 } },
		{
			name: 'Beating Wave',
			expression: 'a * sin(b * x) * cos(c * t)',
			vars: { a: 1, b: 1, c: 0.5 }
		}
	];

	onMount(async () => {
		if (browser) {
			try {
				// Load history from storage API first
				await loadHistoryFromStorage();

				// Check for URL parameter expression
				const urlExpression = $page.url.searchParams.get('expression');
				if (urlExpression) {
					expression = decodeURIComponent(urlExpression);
				}

				await initPyodide();
				setupCanvas();

				// If we have a URL expression, use it instead of history
				if (urlExpression) {
					// Parse the URL expression
					parseExpression();

					// Create history entry for URL expression if valid
					if (expression.trim() && isValidExpression(expression.trim())) {
						const urlEntry = createHistoryEntry('From URL');
						addToHistory(urlEntry);
					}
				} else if (history.length > 0) {
					// Load the last history entry if available and no URL expression
					const lastEntry = history[history.length - 1];
					loadHistoryEntry(lastEntry);
				} else {
					// Parse default expression if no history and no URL expression
					parseExpression();

					// Create initial history entry if expression is valid
					if (expression.trim() && isValidExpression(expression.trim())) {
						const initialEntry = createHistoryEntry('Initial Function');
						addToHistory(initialEntry);
					}
				}

				setupCanvasEvents();
			} catch (e) {
				console.error('Error in onMount:', e);
				error = 'Failed to initialize component';
			}
		}
	});

	// Clean up on component destroy
	onDestroy(() => {
		cleanup();
	});

	async function initPyodide() {
		if (!pyodide && browser) {
			isLoading = true;
			try {
				// Check if loadPyodide is already available
				// @ts-ignore - loadPyodide is a global function
				if (typeof globalThis.loadPyodide === 'undefined') {
					// Load pyodide script from static directory
					const script = document.createElement('script');
					script.src = '/pyodide/pyodide.js';
					document.head.appendChild(script);

					// Wait for the script to load
					await new Promise((resolve, reject) => {
						script.onload = resolve;
						script.onerror = reject;
					});
				}

				// Use the global loadPyodide function
				// @ts-ignore - loadPyodide is a global function
				pyodide = await globalThis.loadPyodide({
					indexURL: '/pyodide/',
					fullStdLib: true
				});
				await pyodide.loadPackage(['numpy']);
				isLoading = false;
			} catch (e) {
				console.error('Failed to load pyodide:', e);
				error = 'Failed to load Python environment';
				isLoading = false;
			}
		}
	}

	function setupCanvas() {
		if (canvas) {
			const context = canvas.getContext('2d');
			if (context) {
				ctx = context;
				resizeCanvas();
				window.addEventListener('resize', resizeCanvas);
			}
		}
	}

	function resizeCanvas() {
		if (canvas && ctx) {
			const container = canvas.parentElement;
			if (container) {
				canvas.width = window.innerWidth - 16; // Account for mx-2 margin (8px each side)
				canvas.height = Math.max(400, window.innerHeight * 0.6);
				resolution = Math.max(500, Math.floor(canvas.width / 2)); // Match resolution to canvas width
				// Only draw if pyodide is ready
				if (pyodide && !isLoading) {
					drawFunction();
				}
			}
		}
	}

	function setupCanvasEvents() {
		if (!canvas) return;

		// Mouse events
		canvas.addEventListener('mousedown', handleMouseDown);
		canvas.addEventListener('mousemove', handleMouseMove);
		canvas.addEventListener('mouseup', handleMouseUp);
		canvas.addEventListener('mouseleave', handleMouseUp);
		canvas.addEventListener('wheel', handleWheel);

		// Touch events
		canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
		canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
		canvas.addEventListener('touchend', handleTouchEnd);

		// Prevent context menu on right click
		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	function handleMouseDown(e: MouseEvent) {
		e.preventDefault();
		isDragging = true;
		dragStart = { x: e.clientX, y: e.clientY };
		dragStartView = { xMin, xMax, yMin, yMax };

		// Distinguish between left and right click
		if (e.button === 0) {
			// Left click - check for double click
			const now = Date.now();
			if (now - lastCanvasClickTime < 300) {
				canvasClickCount++;
			} else {
				canvasClickCount = 1;
			}
			lastCanvasClickTime = now;

			// Set drag mode based on click count
			if (canvasClickCount >= 2) {
				dragMode = 'zoom';
				canvas.style.cursor = 'move';
			} else {
				dragMode = 'pan';
				canvas.style.cursor = 'grabbing';
			}
		} else if (e.button === 2) {
			// Right click - zoom mode
			dragMode = 'zoom';
			canvas.style.cursor = 'move';
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const deltaX = e.clientX - dragStart.x;
		const deltaY = e.clientY - dragStart.y;

		if (dragMode === 'pan') {
			// Pan mode - move the view
			const xRange = dragStartView.xMax - dragStartView.xMin;
			const yRange = dragStartView.yMax - dragStartView.yMin;

			const xOffset = -(deltaX / canvas.width) * xRange;
			const yOffset = (deltaY / canvas.height) * yRange;

			xMin = dragStartView.xMin + xOffset;
			xMax = dragStartView.xMax + xOffset;
			yMin = dragStartView.yMin + yOffset;
			yMax = dragStartView.yMax + yOffset;
		} else if (dragMode === 'zoom') {
			// Zoom mode - keep the original world coordinates under the current mouse position
			const sensitivity = 0.01;
			const zoomFactorX = Math.exp(-deltaX * sensitivity);
			const zoomFactorY = Math.exp(deltaY * sensitivity);

			// Get original mouse position in canvas coordinates (when drag started)
			const rect = canvas.getBoundingClientRect();
			const mouseX0 = dragStart.x - rect.left;
			const mouseY0 = dragStart.y - rect.top;

			// Get current mouse position in canvas coordinates
			const mouseX1 = e.clientX - rect.left;
			const mouseY1 = e.clientY - rect.top;

			// Calculate the world coordinates that were under the mouse when drag started
			const worldX0 =
				dragStartView.xMin + (mouseX0 / canvas.width) * (dragStartView.xMax - dragStartView.xMin);
			const worldY0 =
				dragStartView.yMax - (mouseY0 / canvas.height) * (dragStartView.yMax - dragStartView.yMin);

			// Calculate new range sizes based on zoom factors
			const originalXRange = dragStartView.xMax - dragStartView.xMin;
			const originalYRange = dragStartView.yMax - dragStartView.yMin;
			const newXRange = originalXRange * zoomFactorX;
			const newYRange = originalYRange * zoomFactorY;

			// Set new bounds such that worldX0,worldY0 remains under the current mouse position
			xMin = worldX0 - (mouseX1 / canvas.width) * newXRange;
			xMax = worldX0 + (1 - mouseX1 / canvas.width) * newXRange;
			yMin = worldY0 - (1 - mouseY1 / canvas.height) * newYRange;
			yMax = worldY0 + (mouseY1 / canvas.height) * newYRange;
		}

		drawFunction();
	}

	function handleMouseUp() {
		isDragging = false;
		canvas.style.cursor = 'grab';
		dragMode = 'pan'; // Reset to default mode

		// Reset click count after a delay
		setTimeout(() => {
			canvasClickCount = 0;
		}, 300);
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const worldX = xMin + (mouseX / canvas.width) * (xMax - xMin);
		const worldY = yMax - (mouseY / canvas.height) * (yMax - yMin);

		const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

		const xRange = xMax - xMin;
		const yRange = yMax - yMin;
		const newXRange = xRange * zoomFactor;
		const newYRange = yRange * zoomFactor;

		xMin = worldX - (worldX - xMin) * (newXRange / xRange);
		xMax = worldX + (xMax - worldX) * (newXRange / xRange);
		yMin = worldY - (worldY - yMin) * (newYRange / yRange);
		yMax = worldY + (yMax - worldY) * (newYRange / yRange);

		drawFunction();
	}

	function handleTouchStart(e: TouchEvent) {
		e.preventDefault();

		if (e.touches.length === 1) {
			const touch = e.touches[0];
			const now = Date.now();

			// Check for double tap (within 300ms)
			if (now - lastCanvasTouchTime < 300) {
				canvasTouchCount++;
			} else {
				canvasTouchCount = 1;
			}
			lastCanvasTouchTime = now;

			isDragging = true;
			dragStart = { x: touch.clientX, y: touch.clientY };
			dragStartView = { xMin, xMax, yMin, yMax };

			// Set drag mode based on touch count
			if (canvasTouchCount >= 2) {
				dragMode = 'zoom';
			} else {
				dragMode = 'pan';
			}
		} else if (e.touches.length === 2) {
			isZooming = true;
			isDragging = false;
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];
			lastTouchDistance = Math.sqrt(
				Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
			);
		}
	}

	function handleTouchMove(e: TouchEvent) {
		e.preventDefault();

		if (isDragging && e.touches.length === 1) {
			const touch = e.touches[0];
			const deltaX = touch.clientX - dragStart.x;
			const deltaY = touch.clientY - dragStart.y;

			if (dragMode === 'pan') {
				// Pan mode - move the view
				const xRange = dragStartView.xMax - dragStartView.xMin;
				const yRange = dragStartView.yMax - dragStartView.yMin;

				const xOffset = -(deltaX / canvas.width) * xRange;
				const yOffset = (deltaY / canvas.height) * yRange;

				xMin = dragStartView.xMin + xOffset;
				xMax = dragStartView.xMax + xOffset;
				yMin = dragStartView.yMin + yOffset;
				yMax = dragStartView.yMax + yOffset;
			} else if (dragMode === 'zoom') {
				// Zoom mode - keep the original world coordinates under the current touch position
				const sensitivity = 0.01;
				const zoomFactorX = Math.exp(-deltaX * sensitivity);
				const zoomFactorY = Math.exp(deltaY * sensitivity);

				// Get original touch position in canvas coordinates (when drag started)
				const rect = canvas.getBoundingClientRect();
				const touchX0 = dragStart.x - rect.left;
				const touchY0 = dragStart.y - rect.top;

				// Get current touch position in canvas coordinates
				const touchX1 = touch.clientX - rect.left;
				const touchY1 = touch.clientY - rect.top;

				// Calculate the world coordinates that were under the touch when drag started
				const worldX0 =
					dragStartView.xMin + (touchX0 / canvas.width) * (dragStartView.xMax - dragStartView.xMin);
				const worldY0 =
					dragStartView.yMax -
					(touchY0 / canvas.height) * (dragStartView.yMax - dragStartView.yMin);

				// Calculate new range sizes based on zoom factors
				const originalXRange = dragStartView.xMax - dragStartView.xMin;
				const originalYRange = dragStartView.yMax - dragStartView.yMin;
				const newXRange = originalXRange * zoomFactorX;
				const newYRange = originalYRange * zoomFactorY;

				// Set new bounds such that worldX0,worldY0 remains under the current touch position
				xMin = worldX0 - (touchX1 / canvas.width) * newXRange;
				xMax = worldX0 + (1 - touchX1 / canvas.width) * newXRange;
				yMin = worldY0 - (1 - touchY1 / canvas.height) * newYRange;
				yMax = worldY0 + (touchY1 / canvas.height) * newYRange;
			}

			drawFunction();
		} else if (isZooming && e.touches.length === 2) {
			const touch1 = e.touches[0];
			const touch2 = e.touches[1];
			const currentDistance = Math.sqrt(
				Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2)
			);

			if (lastTouchDistance > 0) {
				const zoomFactor = lastTouchDistance / currentDistance;

				const centerX = (touch1.clientX + touch2.clientX) / 2;
				const centerY = (touch1.clientY + touch2.clientY) / 2;

				const rect = canvas.getBoundingClientRect();
				const worldX = xMin + ((centerX - rect.left) / canvas.width) * (xMax - xMin);
				const worldY = yMax - ((centerY - rect.top) / canvas.height) * (yMax - yMin);

				const xRange = xMax - xMin;
				const yRange = yMax - yMin;
				const newXRange = xRange * zoomFactor;
				const newYRange = yRange * zoomFactor;

				xMin = worldX - (worldX - xMin) * (newXRange / xRange);
				xMax = worldX + (xMax - worldX) * (newXRange / xRange);
				yMin = worldY - (worldY - yMin) * (newYRange / yRange);
				yMax = worldY + (yMax - worldY) * (newYRange / yRange);

				drawFunction();
			}

			lastTouchDistance = currentDistance;
		}
	}

	function handleTouchEnd() {
		isDragging = false;
		isZooming = false;
		lastTouchDistance = 0;
		dragMode = 'pan'; // Reset to default mode

		// Reset touch count after a delay
		setTimeout(() => {
			canvasTouchCount = 0;
		}, 300);
	}

	// Variable drag handlers
	function handleVariableMouseDown(e: MouseEvent, varName: string) {
		e.preventDefault();
		variableDragState.isDragging = true;
		variableDragState.variable = varName;
		variableDragState.startValue = variables[varName];
		variableDragState.startX = e.clientX;
		variableDragState.isExponential = e.button === 2; // Right click

		document.addEventListener('mousemove', handleVariableMouseMove);
		document.addEventListener('mouseup', handleVariableMouseUp);
	}

	function handleVariableMouseMove(e: MouseEvent) {
		if (!variableDragState.isDragging) return;

		const deltaX = e.clientX - variableDragState.startX;
		const sensitivity = 0.5; // Increased base sensitivity

		if (variableDragState.isExponential) {
			// Exponential change - reduced sensitivity for better control
			const factor = Math.pow(1.005, deltaX);
			variables[variableDragState.variable] = variableDragState.startValue * factor;
		} else {
			// Linear change with increment proportional to absolute value
			const baseValue = Math.abs(variableDragState.startValue);
			const increment = Math.max(0.01, baseValue * 0.01); // At least 0.01, or 1% of absolute value
			const change = deltaX * sensitivity * increment;
			variables[variableDragState.variable] = variableDragState.startValue + change;
		}

		handleVariableChange();
	}

	function handleVariableMouseUp() {
		variableDragState.isDragging = false;
		document.removeEventListener('mousemove', handleVariableMouseMove);
		document.removeEventListener('mouseup', handleVariableMouseUp);
	}

	function handleVariableTouchStart(e: TouchEvent, varName: string) {
		e.preventDefault();
		const now = Date.now();

		// Check for double tap (within 300ms)
		if (now - variableDragState.lastTouchTime < 300) {
			variableDragState.touchCount++;
		} else {
			variableDragState.touchCount = 1;
		}
		variableDragState.lastTouchTime = now;

		// Start drag immediately, will determine mode based on touch count
		variableDragState.isDragging = true;
		variableDragState.variable = varName;
		variableDragState.startValue = variables[varName];
		variableDragState.startX = e.touches[0].clientX;
		variableDragState.isExponential = variableDragState.touchCount >= 2;

		document.addEventListener('touchmove', handleVariableTouchMove, { passive: false });
		document.addEventListener('touchend', handleVariableTouchEnd);
	}

	function handleVariableTouchMove(e: TouchEvent) {
		if (!variableDragState.isDragging) return;
		e.preventDefault();

		const deltaX = e.touches[0].clientX - variableDragState.startX;
		const sensitivity = 0.5;

		if (variableDragState.isExponential) {
			// Exponential change - reduced sensitivity for better control
			const factor = Math.pow(1.005, deltaX);
			variables[variableDragState.variable] = variableDragState.startValue * factor;
		} else {
			// Linear change
			const baseValue = Math.abs(variableDragState.startValue);
			const increment = Math.max(0.01, baseValue * 0.01);
			const change = deltaX * sensitivity * increment;
			variables[variableDragState.variable] = variableDragState.startValue + change;
		}

		handleVariableChange();
	}

	function handleVariableTouchEnd() {
		variableDragState.isDragging = false;
		document.removeEventListener('touchmove', handleVariableTouchMove);
		document.removeEventListener('touchend', handleVariableTouchEnd);

		// Reset touch count after a delay
		setTimeout(() => {
			variableDragState.touchCount = 0;
		}, 300);
	}

	function parseExpression() {
		if (!pyodide || !expression || !browser) return;

		try {
			const pythonCode = `
import ast
import numpy as np
from numpy import *

def extract_variables(expr_str):
    try:
        tree = ast.parse(expr_str, mode='eval')
        variables = set()
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                variables.add(node.id)
        
        builtins = {'sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs', 'pi', 'e', 'inf', 'nan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh'}
        variables = variables - builtins
        
        return list(variables)
    except Exception as e:
        return []

result = extract_variables("${expression}")
result
			`;

			const result = pyodide.runPython(pythonCode);

			if (result && typeof result.toJs === 'function') {
				const newVars = result.toJs();

				// Check if 't' is in the variables
				const hasT = newVars.includes('t');
				const _wasAnimating = isAnimating;

				// Stop current animation if running
				if (isAnimating) {
					stopAnimation();
				}

				hasTimeVariable = hasT;

				const newVariables: Record<string, number> = {};
				newVars.forEach((varName: string) => {
					if (varName !== 'x' && varName !== 't') {
						newVariables[varName] = variables[varName] || 1;
					}
				});

				variables = newVariables;
				extractedVars = newVars.filter((v: string) => v !== 'x' && v !== 't');

				// Start animation automatically if t variable is present
				if (hasT && pyodide && ctx) {
					startAnimation();
				}

				error = '';
			} else {
				console.error('Invalid result from Python AST parsing:', result);
				error = 'Error parsing expression';
			}
		} catch (e: any) {
			console.error('Error parsing expression:', e);
			error = 'Error parsing expression';
		}
	}

	function drawFunction(animatedT?: number) {
		if (!pyodide || !ctx || !expression || !browser) return;

		try {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			drawAxes();

			const varsCode = Object.entries(variables)
				.map(([name, value]) => `${name} = ${value}`)
				.join('\n');

			// Add t variable if needed
			const tCode = hasTimeVariable && animatedT !== undefined ? `t = ${animatedT}` : '';

			const pythonCode = `
import numpy as np
from numpy import *

${varsCode}
${tCode}

def evaluate_function():
    try:
        x = np.linspace(${xMin}, ${xMax}, ${resolution})
        y = ${expression}
        x_list = x.tolist()
        y_list = y.tolist() if hasattr(y, 'tolist') else [y] * len(x_list)
        return (x_list, y_list)
    except Exception as e:
        print(f"Error evaluating function: {e}")
        return ([], [])

evaluate_function()
			`;

			const result = pyodide.runPython(pythonCode);

			if (result && typeof result.toJs === 'function') {
				const [xValues, yValues] = result.toJs();

				if (xValues && yValues && xValues.length > 0 && yValues.length > 0) {
					plotFunction(xValues, yValues);
					error = '';
				} else {
					error = 'No valid data to plot - check your expression';
				}
			} else {
				error = 'Invalid result from Python execution';
			}
		} catch (e: any) {
			console.error('Error evaluating function:', e);
			error = 'Error evaluating function: ' + e.message;
		}
	}

	function drawAxes() {
		ctx.strokeStyle = '#666';
		ctx.lineWidth = 1;

		// X-axis
		const yZero = canvasY(0);
		if (yZero >= 0 && yZero <= canvas.height) {
			ctx.beginPath();
			ctx.moveTo(0, yZero);
			ctx.lineTo(canvas.width, yZero);
			ctx.stroke();
		}

		// Y-axis
		const xZero = canvasX(0);
		if (xZero >= 0 && xZero <= canvas.width) {
			ctx.beginPath();
			ctx.moveTo(xZero, 0);
			ctx.lineTo(xZero, canvas.height);
			ctx.stroke();
		}

		// Grid lines
		ctx.strokeStyle = '#eee';
		ctx.lineWidth = 0.5;

		// Calculate grid spacing
		const xRange = xMax - xMin;
		const yRange = yMax - yMin;
		const xStep = Math.pow(10, Math.floor(Math.log10(xRange / 10)));
		const yStep = Math.pow(10, Math.floor(Math.log10(yRange / 10)));

		// Vertical grid lines
		ctx.font = '12px Arial';
		ctx.fillStyle = '#666';
		for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
			const canvasXPos = canvasX(x);
			if (canvasXPos >= 0 && canvasXPos <= canvas.width) {
				ctx.beginPath();
				ctx.moveTo(canvasXPos, 0);
				ctx.lineTo(canvasXPos, canvas.height);
				ctx.stroke();

				if (Math.abs(x) > xStep / 100 && yZero >= 0 && yZero <= canvas.height) {
					ctx.fillText(x.toFixed(1), canvasXPos - 15, yZero + 20);
				}
			}
		}

		// Horizontal grid lines
		for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
			const canvasYPos = canvasY(y);
			if (canvasYPos >= 0 && canvasYPos <= canvas.height) {
				ctx.beginPath();
				ctx.moveTo(0, canvasYPos);
				ctx.lineTo(canvas.width, canvasYPos);
				ctx.stroke();

				if (Math.abs(y) > yStep / 100 && xZero >= 0 && xZero <= canvas.width) {
					ctx.fillText(y.toFixed(1), xZero + 10, canvasYPos + 4);
				}
			}
		}
	}

	function plotFunction(xValues: number[], yValues: number[]) {
		ctx.strokeStyle = '#0066cc';
		ctx.lineWidth = 2;
		ctx.beginPath();

		let started = false;
		for (let i = 0; i < xValues.length; i++) {
			const x = xValues[i];
			const y = yValues[i];

			if (!isFinite(y)) continue;

			const canvasXPos = canvasX(x);
			const canvasYPos = canvasY(y);

			if (!started) {
				ctx.moveTo(canvasXPos, canvasYPos);
				started = true;
			} else {
				ctx.lineTo(canvasXPos, canvasYPos);
			}
		}

		ctx.stroke();
	}

	function canvasX(x: number): number {
		return ((x - xMin) / (xMax - xMin)) * canvas.width;
	}

	function canvasY(y: number): number {
		return canvas.height - ((y - yMin) / (yMax - yMin)) * canvas.height;
	}

	function handleExpressionChange() {
		if (!pyodide || isLoading) return;

		// Stop animation when expression changes
		stopAnimation();

		parseExpression();
		if (pyodide && ctx) {
			drawFunction();
		}

		// Update history
		handleHistoryUpdate();
	}

	function handleVariableChange() {
		if (!pyodide || isLoading || !ctx) return;

		// If animating, the animation loop will handle drawing
		if (!isAnimating) {
			drawFunction();
		}

		// Update history
		handleHistoryUpdate();
	}

	function loadPreset(preset: (typeof presetFunctions)[0]) {
		expression = preset.expression.trim();
		variables = Object.fromEntries(
			Object.entries(preset.vars).map(([key, value]) => [key, value ?? 0])
		);
		showPresets = false;

		if (pyodide && !isLoading) {
			// Stop animation when expression changes
			stopAnimation();

			parseExpression();
			if (pyodide && ctx) {
				drawFunction();
			}

			// Create history entry for preset (only if valid)
			if (isValidExpression(expression)) {
				const presetEntry = createHistoryEntry(preset.name);
				addToHistory(presetEntry);
			}
		}
	}

	function animate(timestamp: number) {
		if (!isAnimating) return;

		if (animationStartTime === 0) {
			animationStartTime = timestamp;
		}

		const elapsed = (timestamp - animationStartTime) / 1000; // Convert to seconds
		const cycleDuration = 1 / speed; // Duration of one cycle in seconds
		const progress = (elapsed % cycleDuration) / cycleDuration; // Progress within current cycle (0 to 1)

		// Calculate current t value
		const currentT = tmin + progress * (tmax - tmin);

		// Draw the function with current t
		drawFunction(currentT);

		// Continue animation
		animationId = requestAnimationFrame(animate);
	}

	function startAnimation() {
		if (!hasTimeVariable || isAnimating) return;

		isAnimating = true;
		animationStartTime = 0;
		animationId = requestAnimationFrame(animate);
	}

	function stopAnimation() {
		isAnimating = false;
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
			animationId = null;
		}
		animationStartTime = 0;

		// Draw static function
		if (pyodide && ctx && !isLoading) {
			drawFunction();
		}
	}

	// Clean up animation on component destroy
	function cleanup() {
		if (browser) {
			if (animationId !== null) {
				cancelAnimationFrame(animationId);
			}

			// Clean up variable drag listeners
			document.removeEventListener('mousemove', handleVariableMouseMove);
			document.removeEventListener('mouseup', handleVariableMouseUp);
			document.removeEventListener('touchmove', handleVariableTouchMove);
			document.removeEventListener('touchend', handleVariableTouchEnd);
		}
	}

	function exportAsImage() {
		if (canvas) {
			const link = document.createElement('a');
			link.download = `function-${expression.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
			link.href = canvas.toDataURL();
			link.click();
		}
	}

	function resetView() {
		xMin = -10;
		xMax = 10;
		yMin = -10;
		yMax = 10;
		if (pyodide && ctx && !isLoading) {
			drawFunction();
		}
	}

	// Debounce expression changes to avoid excessive history updates
	let expressionChangeTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		if (expression && pyodide && !isLoading) {
			clearTimeout(expressionChangeTimeout);
			expressionChangeTimeout = setTimeout(() => {
				handleExpressionChange();
			}, 100);
		}
	});
</script>

<div>
	<!-- Controls Section -->
	<div class="mb-6 rounded-2xl bg-white p-6 shadow-lg">
		<!-- Expression Input -->
		<div class="mb-6">
			<div class="mb-2 flex items-baseline gap-4">
				<label for="expression" class="text-sm font-medium text-gray-700"><T>Expression</T></label>
				<div class="text-xs text-gray-500">
					Presets:
					{#each presetFunctions.slice(0, 4) as preset, i (preset.name)}
						<button
							onclick={() => loadPreset(preset)}
							disabled={isLoading}
							class="mr-2 text-blue-600 underline hover:text-blue-800"
						>
							{preset.name}{i < 3 ? ',' : ''}
						</button>
					{/each}
					<button
						onclick={() => (showPresets = !showPresets)}
						disabled={isLoading}
						class="text-gray-600 underline hover:text-gray-800"
					>
						{showPresets ? 'less' : 'more...'}
					</button>
				</div>
			</div>
			<div class="space-y-3">
				<input
					id="expression"
					type="text"
					bind:value={expression}
					placeholder="e.g., a * sin(x) + b"
					disabled={isLoading}
					class="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
				/>
			</div>
		</div>

		<!-- Presets Panel -->
		{#if showPresets}
			<div class="mb-6 rounded-lg bg-gray-50 p-4">
				<h3 class="mb-3 text-lg font-medium text-gray-800"><T>Function Presets</T></h3>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each presetFunctions as preset (preset.name)}
						<button
							onclick={() => loadPreset(preset)}
							disabled={isLoading}
							class="rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
						>
							<div class="font-medium text-gray-800">{preset.name}</div>
							<div class="mt-1 font-mono text-sm text-gray-600">{preset.expression}</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Animation Controls -->
		{#if hasTimeVariable}
			<div class="mb-6">
				<h3 class="mb-3 text-lg font-medium text-gray-800">
					Animation Controls
					{#if isAnimating}
						<span class="text-sm font-normal text-green-600">● Animating</span>
					{/if}
				</h3>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="space-y-1">
						<label for="tmin" class="block text-sm font-medium text-gray-700">t min</label>
						<input
							id="tmin"
							type="number"
							bind:value={tmin}
							step="0.1"
							disabled={isLoading}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div class="space-y-1">
						<label for="tmax" class="block text-sm font-medium text-gray-700">t max</label>
						<input
							id="tmax"
							type="number"
							bind:value={tmax}
							step="0.1"
							disabled={isLoading}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div class="space-y-1">
						<label for="speed" class="block text-sm font-medium text-gray-700"
							>Speed (cycles/sec)</label
						>
						<input
							id="speed"
							type="number"
							bind:value={speed}
							step="0.1"
							min="0.1"
							max="10"
							disabled={isLoading}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				<div class="mt-3 rounded-lg bg-green-50 p-3">
					<p class="text-sm text-green-800">
						<strong><T>Auto-animating:</T></strong> t cycles from {tmin} to {tmax} over {(
							1 / speed
						).toFixed(1)} seconds
					</p>
				</div>
			</div>
		{/if}

		<!-- History Controls -->
		<div class="mb-6">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-lg font-medium text-gray-800"><T>History</T></h3>
				<div class="flex items-center gap-2">
					<button
						onclick={checkpointCurrent}
						disabled={isLoading}
						class="rounded bg-purple-100 px-3 py-1 text-sm text-purple-700 transition-colors hover:bg-purple-200"
					>
						📌 Checkpoint
					</button>
					<button
						onclick={() => (showHistory = !showHistory)}
						disabled={isLoading}
						class="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-200"
					>
						{showHistory ? 'Hide' : 'Show'} History ({history.length})
					</button>
				</div>
			</div>

			{#if showHistory}
				<div class="max-h-60 overflow-y-auto rounded-lg bg-gray-50 p-4">
					{#if history.length === 0}
						<p class="py-4 text-center text-sm text-gray-500">
							No history entries yet. Start by modifying the expression or variables!
						</p>
					{:else}
						<div class="space-y-2">
							{#each history.slice().reverse() as entry (entry.id)}
								<div
									class="flex items-center gap-3 rounded-lg border bg-white p-3 transition-all duration-200 hover:shadow-md"
									class:ring-2={currentHistoryId === entry.id}
									class:ring-blue-500={currentHistoryId === entry.id}
									class:bg-blue-50={currentHistoryId === entry.id}
								>
									<div class="min-w-0 flex-grow">
										{#if renamingEntryId === entry.id}
											<input
												type="text"
												bind:value={renameValue}
												onblur={finishRename}
												onkeydown={(e) => {
													if (e.key === 'Enter') finishRename();
													if (e.key === 'Escape') cancelRename();
												}}
												class="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
												placeholder="Enter name..."
											/>
										{:else}
											<button
												onclick={() => loadHistoryEntry(entry)}
												disabled={isLoading}
												class="w-full text-left"
											>
												<div class="truncate font-medium text-gray-800">{entry.name}</div>
												<div class="truncate font-mono text-xs text-gray-500">
													{entry.expression}
												</div>
												<div class="mt-1 text-xs text-gray-400">
													{new Date(entry.timestamp).toLocaleString()}
													{#if Object.keys(entry.variables).length > 0}
														• {Object.keys(entry.variables).length} variables
													{/if}
												</div>
											</button>
										{/if}
									</div>

									<div class="flex flex-shrink-0 items-center gap-1">
										{#if renamingEntryId === entry.id}
											<button
												onclick={finishRename}
												class="p-1 text-green-600 hover:text-green-800"
												title="Save name"
											>
												✓
											</button>
											<button
												onclick={cancelRename}
												class="p-1 text-gray-600 hover:text-gray-800"
												title="Cancel"
											>
												✕
											</button>
										{:else}
											<button
												onclick={() => startRename(entry)}
												class="p-1 text-blue-600 hover:text-blue-800"
												title="Rename"
											>
												✏️
											</button>
											<button
												onclick={() => removeHistoryEntry(entry.id)}
												class="p-1 text-red-600 hover:text-red-800"
												title="Remove"
											>
												🗑️
											</button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Variables Section - Compact, right before canvas -->
	{#if extractedVars.length > 0}
		<div class="container mx-auto px-4 py-4">
			<div class="rounded-lg bg-white p-4 shadow-lg">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-lg font-medium text-gray-800"><T>Variables</T></h3>
					<div class="text-xs text-gray-500">
						Left drag: linear | Right drag: exponential | Double-tap on mobile for exponential
					</div>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each extractedVars as varName (varName)}
						<div class="flex items-center gap-2">
							<label for={varName} class="w-6 flex-shrink-0 text-sm font-medium text-gray-700"
								>{varName}</label
							>

							<!-- Compact traditional input -->
							<input
								id={varName}
								type="number"
								bind:value={variables[varName]}
								oninput={handleVariableChange}
								step="0.1"
								disabled={isLoading}
								class="w-16 flex-shrink-0 rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
							/>

							<!-- Compact drag bar -->
							<div class="relative flex-grow">
								<div
									class="relative h-5 w-full cursor-grab overflow-hidden rounded bg-gray-200 transition-colors select-none hover:bg-gray-300 active:cursor-grabbing"
									class:bg-blue-100={variableDragState.isDragging &&
										variableDragState.variable === varName}
									onmousedown={(e) => handleVariableMouseDown(e, varName)}
									ontouchstart={(e) => handleVariableTouchStart(e, varName)}
									oncontextmenu={(e) => e.preventDefault()}
									role="slider"
									aria-label="Drag to change {varName} value"
									aria-valuemin="-10"
									aria-valuemax="10"
									aria-valuenow={variables[varName]}
									tabindex="0"
								>
									<!-- Value indicator -->
									<div
										class="absolute top-0 left-0 h-full rounded bg-blue-500 transition-all duration-75"
										class:bg-blue-600={variableDragState.isDragging &&
											variableDragState.variable === varName}
										style="width: {Math.min(
											100,
											Math.max(0, ((variables[varName] + 10) / 20) * 100)
										)}%"
									></div>

									<!-- Value label -->
									<div class="absolute inset-0 flex items-center justify-center">
										<span
											class="bg-opacity-90 rounded bg-white px-1 py-0.5 text-center text-xs font-medium text-gray-700 shadow-sm"
										>
											{variables[varName].toFixed(2)}
										</span>
									</div>
								</div>
							</div>

							<span class="w-8 flex-shrink-0 text-xs text-gray-500">
								{#if variableDragState.isDragging && variableDragState.variable === varName}
									{variableDragState.isExponential ? 'exp' : 'lin'}
								{/if}
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Canvas Section - Full Width -->
	<div class="mx-2 mb-6 border-y border-gray-200 bg-white shadow-lg">
		{#if isLoading}
			<div class="py-8 text-center">
				<div
					class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
				></div>
				<p class="mt-2 text-blue-600"><T>Loading Python environment...</T></p>
			</div>
		{:else if error}
			<div class="mx-4 mb-4 border border-red-200 bg-red-50 p-4">
				<p class="text-red-700">{error}</p>
			</div>
		{/if}

		<div class="canvas-container">
			<canvas
				bind:this={canvas}
				class="block w-full cursor-grab border-0"
				style="touch-action: none;"
			></canvas>

			<div class="border-t border-gray-200 bg-gray-50 py-4 text-center text-sm text-gray-600">
				<p>
					Range: x∈[{xMin.toFixed(2)}, {xMax.toFixed(2)}], y∈[{yMin.toFixed(2)}, {yMax.toFixed(2)}]
					| Resolution: {resolution} points
					{#if isDragging}
						<span class="ml-2 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
							{dragMode === 'pan' ? '↔️ Panning' : '🔍 Zooming'}
						</span>
					{/if}
				</p>
				{#if expression && !isLoading}
					<p class="mt-1 font-mono">f(x) = {expression}</p>
				{/if}
				<div class="mt-3 flex justify-center gap-3">
					<button
						onclick={resetView}
						disabled={isLoading}
						class="rounded bg-blue-100 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200"
					>
						Reset View
					</button>
					<button
						onclick={exportAsImage}
						disabled={isLoading}
						class="rounded bg-green-100 px-3 py-1 text-xs text-green-700 transition-colors hover:bg-green-200"
					>
						Export PNG
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Help Section -->
	<div class="container mx-auto px-4 py-8">
		<details class="rounded-lg border border-gray-200 bg-white shadow-lg">
			<summary
				class="cursor-pointer bg-gray-50 px-4 py-3 font-medium text-gray-800 transition-colors hover:bg-gray-100"
			>
				📖 Help & Available Functions
			</summary>
			<div class="bg-white p-4">
				<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="mb-2 border-b-2 border-blue-200 pb-1 font-medium text-gray-800">
							Basic Functions
						</h4>
						<ul class="space-y-1 text-sm text-gray-600">
							<li><code class="rounded bg-gray-100 px-1">sin(x)</code> - Sine</li>
							<li><code class="rounded bg-gray-100 px-1">cos(x)</code> - Cosine</li>
							<li><code class="rounded bg-gray-100 px-1">tan(x)</code> - Tangent</li>
							<li><code class="rounded bg-gray-100 px-1">exp(x)</code> - Exponential</li>
							<li><code class="rounded bg-gray-100 px-1">log(x)</code> - Natural log</li>
							<li><code class="rounded bg-gray-100 px-1">sqrt(x)</code> - Square root</li>
							<li><code class="rounded bg-gray-100 px-1">abs(x)</code> - Absolute value</li>
						</ul>
					</div>
					<div>
						<h4 class="mb-2 border-b-2 border-blue-200 pb-1 font-medium text-gray-800">
							Advanced Functions
						</h4>
						<ul class="space-y-1 text-sm text-gray-600">
							<li><code class="rounded bg-gray-100 px-1">arcsin(x)</code> - Inverse sine</li>
							<li><code class="rounded bg-gray-100 px-1">arccos(x)</code> - Inverse cosine</li>
							<li><code class="rounded bg-gray-100 px-1">arctan(x)</code> - Inverse tangent</li>
							<li><code class="rounded bg-gray-100 px-1">sinh(x)</code> - Hyperbolic sine</li>
							<li><code class="rounded bg-gray-100 px-1">cosh(x)</code> - Hyperbolic cosine</li>
							<li><code class="rounded bg-gray-100 px-1">tanh(x)</code> - Hyperbolic tangent</li>
						</ul>
					</div>
					<div>
						<h4 class="mb-2 border-b-2 border-blue-200 pb-1 font-medium text-gray-800">
							Constants & Operators
						</h4>
						<ul class="space-y-1 text-sm text-gray-600">
							<li><code class="rounded bg-gray-100 px-1">pi</code> - π (3.14159...)</li>
							<li><code class="rounded bg-gray-100 px-1">e</code> - Euler's number</li>
							<li><code class="rounded bg-gray-100 px-1">**</code> - Exponentiation</li>
							<li><code class="rounded bg-gray-100 px-1">+, -, *, /</code> - Basic arithmetic</li>
							<li><code class="rounded bg-gray-100 px-1">(...)</code> - Parentheses</li>
						</ul>
					</div>
				</div>
				<div class="mt-6 rounded-lg bg-purple-50 p-4">
					<h4 class="mb-2 border-b-2 border-purple-200 pb-1 font-medium text-gray-800">
						🎬 Automatic Animation with Time Variable
					</h4>
					<p class="mb-3 text-sm text-gray-700">
						Use the special variable <code class="rounded bg-gray-100 px-1">t</code> to create
						animated functions. Animation starts automatically when
						<code class="rounded bg-gray-100 px-1">t</code> is detected in your expression.
					</p>
					<div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
						<div>
							<p class="font-medium text-gray-800"><T>Examples:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><code class="rounded bg-gray-100 px-1">sin(x + t)</code> - Traveling wave</li>
								<li>
									<code class="rounded bg-gray-100 px-1">sin(x) * cos(t)</code> - Amplitude modulation
								</li>
								<li><code class="rounded bg-gray-100 px-1">sin(x - 2*t)</code> - Moving wave</li>
								<li>
									<code class="rounded bg-gray-100 px-1">exp(-t) * sin(x)</code> - Decaying oscillation
								</li>
							</ul>
						</div>
						<div>
							<p class="font-medium text-gray-800"><T>Animation Controls:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong><T>t min/max:</T></strong> Range of t values</li>
								<li><strong><T>Speed:</T></strong> Cycles per second</li>
								<li><strong><T>Auto-start:</T></strong> Begins when t is detected</li>
								<li><T>Animation loops continuously from min to max</T></li>
							</ul>
						</div>
					</div>
				</div>
				<div class="mt-4 rounded-lg bg-green-50 p-4">
					<h4 class="mb-2 border-b-2 border-green-200 pb-1 font-medium text-gray-800">
						🎛️ Interactive Variable Control
					</h4>
					<p class="mb-3 text-sm text-gray-700">
						Variables can be controlled by dragging the colored bars above each input field.
					</p>
					<div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
						<div>
							<p class="font-medium text-gray-800"><T>Drag Modes:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong>Left Click + Drag:</strong> Linear change</li>
								<li><strong>Right Click + Drag:</strong> Exponential change</li>
								<li><strong><T>Mobile:</T></strong> Tap and drag (linear)</li>
								<li><strong><T>Mobile:</T></strong> Double-tap and drag (exponential)</li>
							</ul>
						</div>
						<div>
							<p class="font-medium text-gray-800"><T>How it works:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><T>Linear: Increments scale with current value</T></li>
								<li><T>Exponential: Multiply/divide by factor</T></li>
								<li><T>Real-time: Function updates as you drag</T></li>
								<li><T>Precise: Use input fields for exact values</T></li>
							</ul>
						</div>
					</div>
				</div>
				<div class="mt-4 rounded-lg bg-orange-50 p-4">
					<h4 class="mb-2 border-b-2 border-orange-200 pb-1 font-medium text-gray-800">
						📚 History & Checkpoints
					</h4>
					<p class="mb-3 text-sm text-gray-700">
						The history system automatically saves your work and allows you to revisit previous
						functions.
					</p>
					<div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
						<div>
							<p class="font-medium text-gray-800"><T>Smart History:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong><T>Auto-save:</T></strong> Only valid formulas are tracked</li>
								<li><strong><T>Smart updates:</T></strong> Same formula = update variables</li>
								<li><strong><T>New entries:</T></strong> Different formula = new entry</li>
								<li><strong><T>Auto-trim:</T></strong> Spaces are automatically trimmed</li>
								<li><strong><T>Checkpoint:</T></strong> Manually save current state</li>
								<li><strong><T>Names:</T></strong> Click rename to give entries custom names</li>
							</ul>
						</div>
						<div>
							<p class="font-medium text-gray-800"><T>History Management:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong><T>Auto-resume:</T></strong> Loads your last function on startup</li>
								<li><strong><T>Click entry:</T></strong> Load function and variables</li>
								<li><strong>Rename (✏️):</strong> Give entries meaningful names</li>
								<li><strong>Remove (🗑️):</strong> Delete unwanted entries</li>
								<li><strong><T>Limit:</T></strong> Keeps last 50 entries automatically</li>
								<li><strong><T>Current:</T></strong> Blue highlight shows active entry</li>
							</ul>
						</div>
					</div>
				</div>
				<div class="mt-4 rounded-lg bg-blue-50 p-4">
					<h4 class="mb-2 border-b-2 border-blue-200 pb-1 font-medium text-gray-800">
						🖱️ Canvas Interaction
					</h4>
					<div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
						<div>
							<p class="font-medium text-gray-800"><T>Mouse Controls:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong>Left Click + Drag:</strong> Pan/move the view</li>
								<li><strong>Double Click + Drag:</strong> Zoom X/Y separately</li>
								<li><strong>Right Click + Drag:</strong> Zoom X/Y separately</li>
								<li><strong><T>Mouse Wheel:</T></strong> Zoom at cursor position</li>
								<li><strong><T>Drag left/right:</T></strong> Zoom X-axis in/out</li>
								<li><strong><T>Drag up/down:</T></strong> Zoom Y-axis out/in</li>
							</ul>
						</div>
						<div>
							<p class="font-medium text-gray-800"><T>Touch Controls:</T></p>
							<ul class="space-y-1 text-gray-600">
								<li><strong>Single Tap + Drag:</strong> Pan/move the view</li>
								<li><strong>Double Tap + Drag:</strong> Zoom X/Y separately</li>
								<li><strong><T>Pinch Gesture:</T></strong> Zoom at touch center</li>
								<li><strong><T>Drag left/right:</T></strong> Zoom X-axis in/out</li>
								<li><strong><T>Drag up/down:</T></strong> Zoom Y-axis out/in</li>
								<li><T>Zoom centers around your touch/click point</T></li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</details>
	</div>
</div>
