import * as RNFS from '@dr.pogodin/react-native-fs';
import {makeAutoObservable, observable} from 'mobx';
import {NativeEventEmitter, Platform} from 'react-native';

import {
  DownloadEventCallbacks,
  DownloadJob,
  DownloadMap,
  DownloadProgress,
} from './types';

import {Model} from '../../utils/types';
import {formatBytes, hasEnoughSpace} from '../../utils';
import {uiStore} from '../../store';
import NativeDownloadModule from '../../specs/NativeDownloadModule';
import type {
  DownloadConfig,
  DownloadResponse,
} from '../../specs/NativeDownloadModule';

const TAG = 'DownloadManager';

export class DownloadManager {
  private downloadJobs: DownloadMap;
  private callbacks: DownloadEventCallbacks = {};
  private eventEmitter: NativeEventEmitter | null = null;

  constructor() {
    this.downloadJobs = observable.map(new Map());
    makeAutoObservable(this);

    if (Platform.OS === 'android') {
      this.setupAndroidEventListener();
    }
  }

  private setupAndroidEventListener() {
    if (NativeDownloadModule) {
      this.eventEmitter = new NativeEventEmitter(NativeDownloadModule as any);

      this.eventEmitter.addListener('onDownloadProgress', event => {
        // Find the job by download ID
        const job = Array.from(this.downloadJobs.values()).find(
          _job => _job.downloadId === event.downloadId,
        );

        if (!job) {
          return;
        }

        // Calculate speed
        const currentTime = Date.now();
        const timeDiff = (currentTime - job.lastUpdateTime) / 1000 || 1;
        const bytesDiff = event.bytesWritten - job.lastBytesWritten;
        const speedBps = bytesDiff / timeDiff;
        const speedMBps = (speedBps / (1024 * 1024)).toFixed(2);

        // Calculate ETA
        const remainingBytes = event.totalBytes - event.bytesWritten;
        const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;
        const etaMinutes = Math.ceil(etaSeconds / 60);
        const l10nData = uiStore.l10n;
        const etaText =
          etaSeconds >= 60
            ? `${etaMinutes} ${l10nData.common.minutes}`
            : `${Math.ceil(etaSeconds)} ${l10nData.common.seconds}`;

        const progress: DownloadProgress = {
          bytesDownloaded: event.bytesWritten,
          bytesTotal: event.totalBytes,
          progress: event.progress,
          speed: `${formatBytes(event.bytesWritten)} (${speedMBps} MB/s)`,
          eta: etaText,
          rawSpeed: speedBps,
          rawEta: etaSeconds,
        };

        // console.log(
        //   `${TAG}: Updating progress for model ${job.model.id}:`,
        //   progress,
        // );

        // Update job state
        job.state.progress = progress;
        job.lastBytesWritten = event.bytesWritten;
        job.lastUpdateTime = currentTime;

        this.callbacks.onProgress?.(job.model.id, progress);
      });

      this.eventEmitter.addListener('onDownloadComplete', event => {
        // Find the job by download ID
        const job = Array.from(this.downloadJobs.values()).find(
          _job => _job.downloadId === event.downloadId,
        );

        if (job) {
          // Set final state before removing
          job.state.isDownloading = false;
          job.state.progress = {
            bytesDownloaded: job.state.progress?.bytesTotal || 0,
            bytesTotal: job.state.progress?.bytesTotal || 0,
            progress: 100,
            speed: '0 B/s',
            eta: '0 sec',
            rawSpeed: 0,
            rawEta: 0,
          };
          // Ensure callback is called before removing the job
          this.callbacks.onComplete?.(job.model.id);
          this.downloadJobs.delete(job.model.id);
        }
      });

      this.eventEmitter.addListener('onDownloadFailed', event => {
        // Find the job by download ID
        const job = Array.from(this.downloadJobs.values()).find(
          _job => _job.downloadId === event.downloadId,
        );

        if (job) {
          job.state.error = new Error(event.error);
          job.state.isDownloading = false;
          // Ensure callback is called before removing the job
          this.callbacks.onError?.(job.model.id, new Error(event.error));
          this.downloadJobs.delete(job.model.id);
        }
      });
    }
  }

  private calculateEta(
    bytesDownloaded: number,
    totalBytes: number,
    speedBps: number,
  ): string {
    const l10nData = uiStore.l10n;
    if (speedBps <= 0) {
      return l10nData.common.calculating;
    }

    const remainingBytes = totalBytes - bytesDownloaded;
    const etaSeconds = remainingBytes / speedBps;
    const etaMinutes = Math.ceil(etaSeconds / 60);

    const eta =
      etaSeconds >= 60
        ? `${etaMinutes} ${l10nData.common.minutes}`
        : `${Math.ceil(etaSeconds)} ${l10nData.common.seconds}`;
    return eta;
  }

  setCallbacks(callbacks: DownloadEventCallbacks) {
    this.callbacks = callbacks;
  }

  isDownloading(modelId: string): boolean {
    const isDownloading = this.downloadJobs.has(modelId);
    return isDownloading;
  }

  getDownloadProgress(modelId: string): number {
    const progress =
      this.downloadJobs.get(modelId)?.state.progress?.progress || 0;
    return progress;
  }

  async startDownload(
    model: Model,
    destinationPath: string,
    authToken?: string | null,
  ): Promise<void> {
    if (this.isDownloading(model.id)) {
      return;
    }

    if (!model.downloadUrl) {
      throw new Error('Model has no download URL');
    }

    const isEnoughSpace = await hasEnoughSpace(model);
    if (!isEnoughSpace) {
      throw new Error('Not enough storage space to download the model');
    }

    const dirPath = destinationPath.substring(
      0,
      destinationPath.lastIndexOf('/'),
    );
    try {
      await RNFS.mkdir(dirPath);
    } catch (err) {
      throw err;
    }

    if (Platform.OS === 'ios') {
      await this.startIOSDownload(model, destinationPath, authToken);
    } else {
      await this.startAndroidDownload(model, destinationPath, authToken);
    }
  }

  private async startIOSDownload(
    model: Model,
    destinationPath: string,
    authToken?: string | null,
  ): Promise<void> {
    try {
      const downloadJob: DownloadJob = {
        model,
        state: {
          isDownloading: true,
          progress: null,
          error: null,
        },
        destination: destinationPath,
        lastBytesWritten: 0,
        lastUpdateTime: Date.now(),
      };

      this.downloadJobs.set(model.id, downloadJob);
      this.callbacks.onStart?.(model.id);

      // Create the download task
      const downloadResult = RNFS.downloadFile({
        fromUrl: model.downloadUrl!,
        toFile: destinationPath,
        background: uiStore.iOSBackgroundDownloading,
        discretionary: false,
        progressInterval: 800,
        headers: {
          ...(authToken ? {Authorization: `Bearer ${authToken}`} : {}),
        },
        begin: res => {
          // Initialize progress
          const progress: DownloadProgress = {
            bytesDownloaded: 0,
            bytesTotal: res.contentLength,
            progress: 0,
            speed: '0 B/s',
            eta: uiStore.l10n.common.calculating,
            rawSpeed: 0,
            rawEta: 0,
          };

          downloadJob.state.progress = progress;
          this.callbacks.onProgress?.(model.id, progress);
        },
        progress: res => {
          if (!this.downloadJobs.has(model.id)) {
            return;
          }

          const job = this.downloadJobs.get(model.id)!;
          const currentTime = Date.now();
          const timeDiff = (currentTime - job.lastUpdateTime) / 1000 || 1;
          const bytesDiff = res.bytesWritten - job.lastBytesWritten;
          const speedBps = bytesDiff / timeDiff;
          const speedMBps = (speedBps / (1024 * 1024)).toFixed(2);

          const remainingBytes = res.contentLength - res.bytesWritten;
          const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0;
          const etaMinutes = Math.ceil(etaSeconds / 60);
          const l10nData = uiStore.l10n;
          const etaText =
            etaSeconds >= 60
              ? `${etaMinutes} ${l10nData.common.minutes}`
              : `${Math.ceil(etaSeconds)} ${l10nData.common.seconds}`;

          const progress: DownloadProgress = {
            bytesDownloaded: res.bytesWritten,
            bytesTotal: res.contentLength,
            progress: (res.bytesWritten / res.contentLength) * 100,
            speed: `${formatBytes(res.bytesWritten)} (${speedMBps} MB/s)`,
            eta: etaText,
            rawSpeed: speedBps,
            rawEta: etaSeconds,
          };

          job.state.progress = progress;
          job.lastBytesWritten = res.bytesWritten;
          job.lastUpdateTime = currentTime;

          this.callbacks.onProgress?.(model.id, progress);
        },
      });

      // Store the jobId immediately for cancellation
      downloadJob.jobId = downloadResult.jobId;


      // Add job to map after setting jobId
      this.downloadJobs.set(model.id, downloadJob);

      // Wait for the download to complete
      const result = await downloadResult.promise;

      if (result.statusCode === 200) {
        this.callbacks.onComplete?.(model.id);
        this.downloadJobs.delete(model.id);
      } else {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }
    } catch (error) {

      const job = this.downloadJobs.get(model.id);
      if (job) {
        job.state.error =
          error instanceof Error ? error : new Error(String(error));
        job.state.isDownloading = false;
      }
      this.downloadJobs.delete(model.id);
      this.callbacks.onError?.(
        model.id,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async startAndroidDownload(
    model: Model,
    destinationPath: string,
    authToken?: string | null,
  ): Promise<void> {
    try {


      const downloadJob: DownloadJob = {
        model,
        state: {
          isDownloading: true,
          progress: null,
          error: null,
        },
        destination: destinationPath,
        lastBytesWritten: 0,
        lastUpdateTime: Date.now(),
      };

      // Start the download first to get the download ID
      const config: DownloadConfig = {
        destination: destinationPath,
        networkType: 'ANY',
        priority: 1,
        progressInterval: 1000,
        ...(authToken ? {authToken} : {}),
      };
      const response: DownloadResponse =
        await NativeDownloadModule.startDownload(model.downloadUrl!, config);

      // Store the download ID
      downloadJob.downloadId = response.downloadId;

      // Add job to map after getting download ID
      this.downloadJobs.set(model.id, downloadJob);
      this.callbacks.onStart?.(model.id);
    } catch (error) {


      const job = this.downloadJobs.get(model.id);
      if (job) {
        job.state.error =
          error instanceof Error ? error : new Error(String(error));
        job.state.isDownloading = false;
      }
      this.downloadJobs.delete(model.id);
      this.callbacks.onError?.(
        model.id,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async cancelDownload(modelId: string): Promise<void> {
    const job = this.downloadJobs.get(modelId);
    if (job) {
      try {
        if (Platform.OS === 'ios') {
          if (job.jobId) {
            RNFS.stopDownload(job.jobId); // job.jobId is now correctly typed as number
          }
        } else if (
          Platform.OS === 'android' &&
          NativeDownloadModule &&
          job.downloadId
        ) {
          await NativeDownloadModule.cancelDownload(job.downloadId);
        }

        // Clean up the partial download file
        const destinationPath = job.destination;
        if (destinationPath) {
          try {
            const exists = await RNFS.exists(destinationPath);
            if (exists) {
              await RNFS.unlink(destinationPath);
            }
          } catch (fileError) {
            if ((fileError as any)?.code !== 'ENOENT') {
            }
          }
        }

        // Update state and remove job
        job.state.isDownloading = false;
        this.downloadJobs.delete(modelId);
      } catch (err) {
      }
    }
  }

  cleanup() {
    if (Platform.OS === 'android' && this.eventEmitter) {
      this.eventEmitter.removeAllListeners('onDownloadProgress');
      this.eventEmitter.removeAllListeners('onDownloadComplete');
      this.eventEmitter.removeAllListeners('onDownloadFailed');
    }
    this.downloadJobs.clear();
  }

  /**
   * Synchronizes the downloadJobs map with active downloads in the native layer.
   * This should be called after the model store is initialized.
   */
  syncWithActiveDownloads = async (models: Model[]): Promise<void> => {
    if (Platform.OS !== 'android' || !NativeDownloadModule) {
      return;
    }

    try {
      // Get active downloads from native module
      const activeDownloads = await NativeDownloadModule.getActiveDownloads();

      if (activeDownloads.length === 0) {
        return;
      }

      // For each active download, find the corresponding model and create a download job
      for (const download of activeDownloads) {
        const model = models.find(m => {
          return m.downloadUrl && download.url === m.downloadUrl;
        });

        if (!model) {
          continue;
        }

        // Parse progress value safely
        const progress =
          typeof download.progress === 'string'
            ? parseFloat(download.progress)
            : download.progress || 0;

        // Calculate bytes from model size and progress
        const totalBytes = model.size || 0;
        const bytesWritten = Math.floor((totalBytes * progress) / 100);

        // Create a download job for this model
        const downloadJob: DownloadJob = {
          model,
          downloadId: download.id,
          state: {
            isDownloading: true,
            progress: {
              bytesDownloaded: bytesWritten,
              bytesTotal: totalBytes,
              progress: progress,
              speed: '0 B/s',
              eta: uiStore.l10n.common.calculating,
              rawSpeed: 0,
              rawEta: 0,
            },
            error: null,
          },
          destination: download.destination,
          lastBytesWritten: bytesWritten,
          lastUpdateTime: Date.now(),
        };

        // Add to downloadJobs map
        this.downloadJobs.set(model.id, downloadJob);

        // Notify listeners that download is in progress
        this.callbacks.onStart?.(model.id);

        // Re-register for progress updates by calling the native module
        try {
          // We need to tell the native module to re-register the observer for this download
          if (NativeDownloadModule.reattachDownloadObserver) {
            await NativeDownloadModule.reattachDownloadObserver(download.id);
          }
        } catch (error) {
        }
      }
    } catch (error) {
    }
  };
}
