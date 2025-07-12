import {
	AutoTokenizer,
	AutoModelForCausalLM,
	TextStreamer,
	InterruptableStoppingCriteria,
	env
} from '@huggingface/transformers';
import type { PreTrainedModel, PreTrainedTokenizer } from '@huggingface/transformers';

// Skip local model check and use browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

class TextGenerationPipelineSingleton {
	static model_id = 'onnx-community/Qwen3-0.6B-ONNX';
	static tokenizer: PreTrainedTokenizer | null = null;
	static model: PreTrainedModel | null = null;

	static async getInstance(progress_callback: (progress: any) => void) {
		if (this.tokenizer === null) {
			this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id, {
				progress_callback
			});
		}

		if (this.model === null) {
			this.model = await AutoModelForCausalLM.from_pretrained(this.model_id, {
				dtype: 'q4f16',
				device: 'webgpu',
				progress_callback
			});
		}

		return Promise.all([this.tokenizer, this.model]);
	}
}

let past_key_values_cache: any = null;

async function generate(
	data: any,
	port: MessagePort,
	stopping_criteria: InterruptableStoppingCriteria
) {
	const { userInput, chat_history, topK, temperature, maxTokens } = data;
	const messages = [...chat_history, { role: 'user', content: userInput }];

	// Get the already loaded model instances without progress callbacks during generation
	const [tokenizer, model] = await TextGenerationPipelineSingleton.getInstance(() => {
		// No progress updates during generation
	});

	if (!tokenizer || !model) {
		port.postMessage({ type: 'generate_error', data: 'Tokenizer or model not loaded.' });
		return;
	}

	const inputs = tokenizer.apply_chat_template(messages, {
		add_generation_prompt: true,
		return_dict: true
	});

	let streamedContent = '';
	const streamer = new TextStreamer(tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		callback_function: (output: string) => {
			streamedContent += output;
			port.postMessage({ type: 'update', data: output }); // Send only the new token
		}
	});

	port.postMessage({ type: 'start_generate' });

	try {
		const result = (await model.generate({
			...(inputs as any),
			past_key_values: past_key_values_cache,
			do_sample: true,
			top_k: topK,
			temperature: temperature,
			max_new_tokens: maxTokens,
			streamer,
			stopping_criteria,
			return_dict_in_generate: true
		})) as any;

		past_key_values_cache = result.past_key_values;
		port.postMessage({ type: 'complete', data: streamedContent });
	} catch (e: any) {
		port.postMessage({ type: 'generate_error', data: e.message });
	}
}

async function load(port: MessagePort) {
	port.postMessage({ type: 'progress', data: { status: 'loading', file: 'model', progress: 0 } });

	const [tokenizer, model] = await TextGenerationPipelineSingleton.getInstance((progress: any) => {
		// Format progress data to match UI expectations
		const formattedProgress = {
			status: progress.status || 'loading',
			file: progress.file || progress.name || 'model files',
			progress: progress.progress || 0,
			loaded: progress.loaded || 0,
			total: progress.total || 0
		};
		port.postMessage({ type: 'progress', data: formattedProgress });
	});

	if (!tokenizer || !model) {
		port.postMessage({ type: 'init_error', data: 'Failed to load model.' });
		return;
	}

	port.postMessage({
		type: 'progress',
		data: { status: 'Compiling shaders...', file: 'WebGPU shaders', progress: 95 }
	});

	const inputs = tokenizer('a', { return_tensors: 'ort' });
	await model.generate({ ...inputs, max_new_tokens: 1 });

	port.postMessage({
		type: 'progress',
		data: { status: 'Model loaded successfully!', file: 'complete', progress: 100 }
	});

	port.postMessage({ type: 'init_done' });
}

(self as any).onconnect = function (event: MessageEvent) {
	const port = (event as MessageEvent).ports[0];
	const stopping_criteria = new InterruptableStoppingCriteria();

	port.onmessage = async (e: MessageEvent) => {
		const { type, data } = e.data;
		switch (type) {
			case 'init': // Changed from 'load' to 'init' to match svelte component
				await load(port);
				break;
			case 'generate':
				stopping_criteria.reset();
				await generate(data, port, stopping_criteria);
				break;
			case 'interrupt':
				stopping_criteria.interrupt();
				break;
			case 'reset':
				past_key_values_cache = null;
				stopping_criteria.reset();
				port.postMessage({ type: 'reset_done' });
				break;
		}
	};
};
