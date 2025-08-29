#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { 
  createAudioDecoder, 
  createAudioCapture, 
  createAudioFileReader,
  AudioPresets 
} from '@gibberlink/audio-decoder';
import { FramerV1, JSONCodec } from '@gibberlink/protocol-core';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('audio-demo')
  .description('Gibberlink Audio Decoder Demo - Test AI-to-AI acoustic protocols')
  .version('1.0.0');

// Microphone recording command
program
  .command('mic')
  .description('Record from microphone and decode in real-time')
  .option('-p, --preset <preset>', 'Audio processing preset (highQuality|lowLatency|noiseResistant)', 'lowLatency')
  .option('-d, --device <device>', 'Audio device ID')
  .option('-t, --timeout <seconds>', 'Recording timeout in seconds', '30')
  .action(async (options) => {
    const spinner = ora('Initializing audio capture...').start();
    
    try {
      // Create audio decoder with preset
      const decoder = createAudioDecoder(AudioPresets[options.preset as keyof typeof AudioPresets]);
      const capture = createAudioCapture('node', {
        sampleRate: AudioPresets[options.preset as keyof typeof AudioPresets].sampleRate,
        device: options.device
      });

      spinner.text = 'Starting microphone capture...';
      
      // Set up frame callback
      decoder.onFrame((frame) => {
        console.log(chalk.green('\n🎵 Decoded frame:'));
        console.log(chalk.cyan(`  SNR: ${frame.snrDb.toFixed(2)} dB`));
        console.log(chalk.cyan(`  Size: ${frame.data.length} bytes`));
        console.log(chalk.cyan(`  Timestamp: ${new Date(frame.timestamp).toISOString()}`));
        
        try {
          // Try to decode as JSON
          const text = new TextDecoder().decode(frame.data);
          const json = JSON.parse(text);
          console.log(chalk.yellow('  Payload:'), JSON.stringify(json, null, 2));
        } catch {
          console.log(chalk.yellow('  Payload:'), frame.data);
        }
      });

      // Set up audio chunk processing
      capture.onChunk((chunk) => {
        const frames = decoder.decodeChunk(chunk.pcm);
        if (frames.length > 0) {
          console.log(chalk.blue(`\n📡 Processed ${frames.length} frames from audio chunk`));
        }
      });

      await capture.start();
      spinner.succeed('Microphone capture started');

      console.log(chalk.green('\n🎤 Listening for encoded audio...'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));

      // Set timeout
      const timeout = setTimeout(async () => {
        console.log(chalk.yellow('\n⏰ Recording timeout reached'));
        await capture.stop();
        process.exit(0);
      }, parseInt(options.timeout) * 1000);

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        clearTimeout(timeout);
        console.log(chalk.yellow('\n🛑 Stopping audio capture...'));
        await capture.stop();
        
        const stats = decoder.getStats();
        console.log(chalk.blue('\n📊 Final Statistics:'));
        console.log(chalk.cyan(`  Total chunks processed: ${stats.totalChunks}`));
        console.log(chalk.cyan(`  Total frames decoded: ${stats.totalFrames}`));
        console.log(chalk.cyan(`  Average SNR: ${stats.averageSnr.toFixed(2)} dB`));
        console.log(chalk.cyan(`  Error rate: ${(stats.errorRate * 100).toFixed(2)}%`));
        
        process.exit(0);
      });

    } catch (error) {
      spinner.fail('Failed to start audio capture');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// File processing command
program
  .command('file <filepath>')
  .description('Decode audio from file (WAV/MP3)')
  .option('-p, --preset <preset>', 'Audio processing preset (highQuality|lowLatency|noiseResistant)', 'highQuality')
  .option('-o, --output <filepath>', 'Output file for decoded data')
  .action(async (filepath, options) => {
    const spinner = ora('Loading audio file...').start();
    
    try {
      if (!fs.existsSync(filepath)) {
        spinner.fail('File not found');
        console.error(chalk.red(`Error: File '${filepath}' does not exist`));
        process.exit(1);
      }

      const fileReader = createAudioFileReader();
      const chunks = await fileReader.readFile(filepath);
      
      spinner.text = 'Processing audio chunks...';
      
      const decoder = createAudioDecoder(AudioPresets[options.preset as keyof typeof AudioPresets]);
      const results: any[] = [];
      
      let totalFrames = 0;
      for (const chunk of chunks) {
        const frames = decoder.decodeChunk(chunk.pcm);
        totalFrames += frames.length;
        
        for (const frame of frames) {
          try {
            const text = new TextDecoder().decode(frame);
            const json = JSON.parse(text);
            results.push({
              timestamp: chunk.timestamp,
              data: json,
              size: frame.length
            });
          } catch {
            results.push({
              timestamp: chunk.timestamp,
              data: Array.from(frame),
              size: frame.length
            });
          }
        }
      }
      
      spinner.succeed(`Processed ${chunks.length} chunks, found ${totalFrames} frames`);

      console.log(chalk.green('\n📄 Decoded Results:'));
      if (results.length === 0) {
        console.log(chalk.yellow('No encoded data found in audio file'));
      } else {
        results.forEach((result, index) => {
          console.log(chalk.blue(`\nFrame ${index + 1}:`));
          console.log(chalk.cyan(`  Timestamp: ${new Date(result.timestamp).toISOString()}`));
          console.log(chalk.cyan(`  Size: ${result.size} bytes`));
          console.log(chalk.yellow('  Data:'), JSON.stringify(result.data, null, 2));
        });
      }

      // Save to output file if specified
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(chalk.green(`\n💾 Results saved to: ${options.output}`));
      }

      const stats = decoder.getStats();
      console.log(chalk.blue('\n📊 Statistics:'));
      console.log(chalk.cyan(`  Total chunks processed: ${stats.totalChunks}`));
      console.log(chalk.cyan(`  Total frames decoded: ${stats.totalFrames}`));
      console.log(chalk.cyan(`  Average SNR: ${stats.averageSnr.toFixed(2)} dB`));
      console.log(chalk.cyan(`  Error rate: ${(stats.errorRate * 100).toFixed(2)}%`));

    } catch (error) {
      spinner.fail('Failed to process audio file');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Generate test audio command
program
  .command('generate <message>')
  .description('Generate test audio with encoded message')
  .option('-o, --output <filepath>', 'Output WAV file path', 'test-encoded.wav')
  .option('-p, --preset <preset>', 'Audio processing preset', 'lowLatency')
  .action(async (message, options) => {
    const spinner = ora('Generating encoded audio...').start();
    
    try {
      const config = AudioPresets[options.preset as keyof typeof AudioPresets];
      const codec = createAudioDecoder(config);
      
      // Create test payload
      const payload = {
        message,
        timestamp: new Date().toISOString(),
        test: true,
        data: {
          source: 'audio-demo',
          version: '1.0.0'
        }
      };
      
      const jsonString = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonString);
      
      // Encode using protocol
      const framer = new Framer();
      const protocolCodec = new Codec();
      
      const encoded = protocolCodec.encode(data);
      const framed = framer.frame(encoded);
      
      // Generate audio (this would need to be implemented in the codec)
      spinner.succeed('Audio generation not yet implemented');
      console.log(chalk.yellow('Audio generation feature coming soon!'));
      console.log(chalk.blue('Generated payload:'), jsonString);
      
    } catch (error) {
      spinner.fail('Failed to generate audio');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// List devices command
program
  .command('devices')
  .description('List available audio input devices')
  .action(async () => {
    const spinner = ora('Scanning audio devices...').start();
    
    try {
      const capture = createAudioCapture('node');
      const devices = await capture.getDevices();
      
      spinner.succeed(`Found ${devices.length} audio input devices`);
      
      if (devices.length === 0) {
        console.log(chalk.yellow('No audio input devices found'));
      } else {
        console.log(chalk.green('\n🎤 Available Audio Input Devices:'));
        devices.forEach((device, index) => {
          console.log(chalk.blue(`\n${index + 1}. ${device.name}`));
          console.log(chalk.cyan(`   ID: ${device.id}`));
          console.log(chalk.cyan(`   Type: ${device.type}`));
          console.log(chalk.cyan(`   Sample Rates: ${device.sampleRates.join(', ')} Hz`));
          console.log(chalk.cyan(`   Channels: ${device.channels}`));
        });
      }
      
    } catch (error) {
      spinner.fail('Failed to scan devices');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
