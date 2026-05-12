import { useState } from 'react';

export function useStudioState() {
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [script, setScript] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const reset = () => {
    setTopic('');
    setTitle('');
    setDescription('');
    setScript('');
    setVideoUrl('');
  };

  return {
    topic, setTopic,
    title, setTitle,
    description, setDescription,
    script, setScript,
    videoUrl, setVideoUrl,
    reset
  };
}