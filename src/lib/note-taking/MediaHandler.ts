export interface MediaData {
	type: string;
	name: string;
	size: number;
	data: string;
	mimeType: string;
}

export class MediaHandler {
	private mediaRecorder: MediaRecorder | null = null;
	private recordedChunks: Blob[] = [];
	private currentStream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private audioLevelArray: Uint8Array | null = null;
	private animationFrame: number | null = null;

	async handleFileUpload(
		file: File,
		checkQuota: (size: number) => Promise<boolean>
	): Promise<MediaData> {
		// Check file size (limit to 5MB for localStorage)
		if (file.size > 5 * 1024 * 1024) {
			throw new Error('File size too large. Please select a file smaller than 5MB.');
		}

		// Estimate the storage needed (base64 encoding increases size by ~33%)
		const estimatedSize = file.size * 1.33;
		const hasSpace = await checkQuota(estimatedSize);
		if (!hasSpace) {
			throw new Error('Storage quota would be exceeded');
		}

		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const mediaData: MediaData = {
					type: file.type.startsWith('image/') ? 'image' : 'file',
					name: file.name,
					size: file.size,
					data: e.target?.result as string,
					mimeType: file.type
				};
				resolve(mediaData);
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

	async startRecording(type: 'audio' | 'video'): Promise<MediaStream> {
		const constraints = type === 'video' ? { video: true, audio: true } : { audio: true };

		const stream = await navigator.mediaDevices.getUserMedia(constraints);
		this.currentStream = stream;
		this.recordedChunks = [];

		// Set up audio visualization for audio recording
		if (type === 'audio') {
			this.setupAudioVisualization(stream);
		}

		const options = { mimeType: type === 'video' ? 'video/webm' : 'audio/webm' };
		this.mediaRecorder = new MediaRecorder(stream, options);

		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				this.recordedChunks.push(event.data);
			}
		};

		this.mediaRecorder.start();
		return stream;
	}

	async stopRecording(
		type: 'audio' | 'video',
		checkQuota: (size: number) => Promise<boolean>
	): Promise<MediaData> {
		return new Promise((resolve, reject) => {
			if (!this.mediaRecorder) {
				reject(new Error('No active recording'));
				return;
			}

			this.mediaRecorder.onstop = async () => {
				try {
					const blob = new Blob(this.recordedChunks, {
						type: type === 'video' ? 'video/webm' : 'audio/webm'
					});

					// Check storage quota
					const estimatedSize = blob.size * 1.33; // Base64 encoding overhead
					const hasSpace = await checkQuota(estimatedSize);
					if (!hasSpace) {
						throw new Error('Storage quota would be exceeded');
					}

					// Convert to base64
					const reader = new FileReader();
					reader.onload = () => {
						const mediaData: MediaData = {
							type: type,
							name: `${type}-${new Date().toISOString()}.webm`,
							size: blob.size,
							data: reader.result as string,
							mimeType: blob.type
						};
						resolve(mediaData);
					};
					reader.onerror = () => reject(new Error('Failed to convert recording'));
					reader.readAsDataURL(blob);
				} catch (error) {
					reject(error);
				} finally {
					this.cleanup();
				}
			};

			this.mediaRecorder.stop();
		});
	}

	private setupAudioVisualization(stream: MediaStream): void {
		try {
			this.audioContext = new AudioContext();
			this.analyser = this.audioContext.createAnalyser();
			const source = this.audioContext.createMediaStreamSource(stream);
			source.connect(this.analyser);

			this.analyser.fftSize = 256;
			this.audioLevelArray = new Uint8Array(this.analyser.frequencyBinCount);

			this.updateAudioLevel();
		} catch (error) {
			console.warn('Audio visualization not supported:', error);
		}
	}

	private updateAudioLevel(): void {
		if (!this.analyser || !this.audioLevelArray) return;

		this.analyser.getByteFrequencyData(this.audioLevelArray);
		const average =
			this.audioLevelArray.reduce((sum, value) => sum + value, 0) / this.audioLevelArray.length;
		const level = Math.round((average / 255) * 100);

		// Update CSS custom property
		document.documentElement.style.setProperty('--audio-level', `${level}%`);

		this.animationFrame = requestAnimationFrame(() => this.updateAudioLevel());
	}

	cleanup(): void {
		// Clean up media recorder
		if (this.mediaRecorder) {
			this.mediaRecorder = null;
		}

		// Clean up audio visualization
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.analyser = null;
		this.audioLevelArray = null;

		// Stop media stream
		if (this.currentStream) {
			this.currentStream.getTracks().forEach((track) => track.stop());
			this.currentStream = null;
		}

		this.recordedChunks = [];
	}

	downloadFile(media: MediaData): void {
		const link = document.createElement('a');
		link.href = media.data;
		link.download = media.name;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	get isRecording(): boolean {
		return this.mediaRecorder?.state === 'recording';
	}

	get hasActiveStream(): boolean {
		return this.currentStream !== null;
	}
}
