/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console, @next/next/no-img-element */

'use client';

import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Radio, Tv } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';

import { parseCustomTimeFormat } from '@/lib/time';

import EpgScrollableRow from '@/components/EpgScrollableRow';
import PageLayout from '@/components/PageLayout';

// 扩展 HTMLVideoElement 类型以支持 hls 属性
declare global {
  interface HTMLVideoElement {
    hls?: any;
    flv?: any;
  }
}

// 直播频道接口
interface LiveChannel {
  id: string;
  tvgId: string;
  name: string;
  logo: string;
  group: string;
  url: string;
}

// 直播源接口
interface LiveSource {
  key: string;
  name: string;
  url: string;  // m3u 地址
  ua?: string;
  epg?: string; // 节目单
  from: 'config' | 'custom';
  channelNumber?: number;
  disabled?: boolean;
}

function LivePageClient() {
  // -----------------------------------------------------------------------------
  // 状态变量（State）
  // -----------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<
    'loading' | 'fetching' | 'ready'
  >('loading');
  const [loadingMessage, setLoadingMessage] = useState('正在加载直播源...');
  const [error, setError] = useState<string | null>(null);

  // 直播源相关
  const [liveSources, setLiveSources] = useState<LiveSource[]>([]);
  const [currentSource, setCurrentSource] = useState<LiveSource | null>(null);
  const currentSourceRef = useRef<LiveSource | null>(null);
  useEffect(() => {
    currentSourceRef.current = currentSource;
  }, [currentSource]);

  // 频道相关
  const [currentChannels, setCurrentChannels] = useState<LiveChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<LiveChannel | null>(null);

  // 播放器相关
  const [videoUrl, setVideoUrl] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // 切换直播源状态
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);

  // 分组相关
  const [groupedChannels, setGroupedChannels] = useState<{ [key: string]: LiveChannel[] }>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Tab 切换
  const [activeTab, setActiveTab] = useState<'channels' | 'sources'>('channels');

  // 频道列表收起状态
  const [isChannelListCollapsed, setIsChannelListCollapsed] = useState(false);

  // 过滤后的频道列表
  const [filteredChannels, setFilteredChannels] = useState<LiveChannel[]>([]);

  // 节目单信息
  const [epgData, setEpgData] = useState<{
    tvgId: string;
    source: string;
    epgUrl: string;
    programs: Array<{
      start: string;
      end: string;
      title: string;
    }>;
  } | null>(null);

  // EPG 数据加载状态
  const [isEpgLoading, setIsEpgLoading] = useState(false);

  // EPG数据清洗函数 - 去除重叠的节目，保留时间较短的，只显示今日节目
  const cleanEpgData = (programs: Array<{ start: string; end: string; title: string }>) => {
    if (!programs || programs.length === 0) return programs;

    console.log(`开始清洗EPG数据，原始节目数量: ${programs.length}`);

    // 获取今日日期（只考虑年月日，忽略时间）
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // 首先过滤出今日的节目（包括跨天节目）
    const todayPrograms = programs.filter(program => {
      const programStart = parseCustomTimeFormat(program.start);
      const programEnd = parseCustomTimeFormat(program.end);

      // 获取节目的日期范围
      const programStartDate = new Date(programStart.getFullYear(), programStart.getMonth(), programStart.getDate());
      const programEndDate = new Date(programEnd.getFullYear(), programEnd.getMonth(), programEnd.getDate());

      // 如果节目的开始时间或结束时间在今天，或者节目跨越今天，都算作今天的节目
      return (
        (programStartDate >= todayStart && programStartDate < todayEnd) || // 开始时间在今天
        (programEndDate >= todayStart && programEndDate < todayEnd) || // 结束时间在今天
        (programStartDate < todayStart && programEndDate >= todayEnd) // 节目跨越今天（跨天节目）
      );
    });

    console.log(`过滤今日节目后数量: ${todayPrograms.length}`);

    // 按开始时间排序
    const sortedPrograms = [...todayPrograms].sort((a, b) => {
      const startA = parseCustomTimeFormat(a.start).getTime();
      const startB = parseCustomTimeFormat(b.start).getTime();
      return startA - startB;
    });

    const cleanedPrograms: Array<{ start: string; end: string; title: string }> = [];
    let removedCount = 0;
    const dateFilteredCount = programs.length - todayPrograms.length;

    for (let i = 0; i < sortedPrograms.length; i++) {
      const currentProgram = sortedPrograms[i];
      const currentStart = parseCustomTimeFormat(currentProgram.start);
      const currentEnd = parseCustomTimeFormat(currentProgram.end);

      // 检查是否与已添加的节目重叠
      let hasOverlap = false;

      for (const existingProgram of cleanedPrograms) {
        const existingStart = parseCustomTimeFormat(existingProgram.start);
        const existingEnd = parseCustomTimeFormat(existingProgram.end);

        // 检查时间重叠（考虑完整的日期和时间）
        if (
          (currentStart >= existingStart && currentStart < existingEnd) || // 当前节目开始时间在已存在节目时间段内
          (currentEnd > existingStart && currentEnd <= existingEnd) || // 当前节目结束时间在已存在节目时间段内
          (currentStart <= existingStart && currentEnd >= existingEnd) // 当前节目完全包含已存在节目
        ) {
          hasOverlap = true;
          break;
        }
      }

      // 如果没有重叠，则添加该节目
      if (!hasOverlap) {
        cleanedPrograms.push(currentProgram);
      } else {
        // 如果有重叠，检查是否需要替换已存在的节目
        for (let j = 0; j < cleanedPrograms.length; j++) {
          const existingProgram = cleanedPrograms[j];
          const existingStart = parseCustomTimeFormat(existingProgram.start);
          const existingEnd = parseCustomTimeFormat(existingProgram.end);

          // 检查是否与当前节目重叠（考虑完整的日期和时间）
          if (
            (currentStart >= existingStart && currentStart < existingEnd) ||
            (currentEnd > existingStart && currentEnd <= existingEnd) ||
            (currentStart <= existingStart && currentEnd >= existingEnd)
          ) {
            // 计算节目时长
            const currentDuration = currentEnd.getTime() - currentStart.getTime();
            const existingDuration = existingEnd.getTime() - existingStart.getTime();

            // 如果当前节目时间更短，则替换已存在的节目
            if (currentDuration < existingDuration) {
              console.log(`替换重叠节目: "${existingProgram.title}" (${existingDuration}ms) -> "${currentProgram.title}" (${currentDuration}ms)`);
              cleanedPrograms[j] = currentProgram;
            } else {
              console.log(`跳过重叠节目: "${currentProgram.title}" (${currentDuration}ms)，保留 "${existingProgram.title}" (${existingDuration}ms)`);
              removedCount++;
            }
            break;
          }
        }
      }
    }

    console.log(`EPG数据清洗完成，清洗后节目数量: ${cleanedPrograms.length}，移除重叠节目: ${removedCount}个，过滤非今日节目: ${dateFilteredCount}个`);
    return cleanedPrograms;
  };

  // 播放器引用
  const artPlayerRef = useRef<any>(null);
  const artRef = useRef<HTMLDivElement | null>(null);

  // 分组标签滚动相关
  const groupContainerRef = useRef<HTMLDivElement>(null);
  const groupButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const channelListRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------------
  // 工具函数（Utils）
  // -----------------------------------------------------------------------------

  // 获取直播源列表
  const fetchLiveSources = async () => {
    try {
      setLoadingStage('fetching');
      setLoadingMessage('正在获取直播源...');

      // 获取 AdminConfig 中的直播源信息
      const response = await fetch('/api/live/sources');
      if (!response.ok) {
        throw new Error('获取直播源失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取直播源失败');
      }

      const sources = result.data;
      setLiveSources(sources);

      if (sources.length > 0) {
        // 默认选中第一个源
        const firstSource = sources[0];
        setCurrentSource(firstSource);
        await fetchChannels(firstSource);
      }

      setLoadingStage('ready');
      setLoadingMessage('✨ 准备就绪...');

      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (err) {
      console.error('获取直播源失败:', err);
      // 不设置错误，而是显示空状态
      setLiveSources([]);
      setLoading(false);
    }
  };

  // 获取频道列表
  const fetchChannels = async (source: LiveSource) => {
    try {
      setIsVideoLoading(true);

      // 从 cachedLiveChannels 获取频道信息
      const response = await fetch(`/api/live/channels?source=${source.key}`);
      if (!response.ok) {
        throw new Error('获取频道列表失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取频道列表失败');
      }

      const channelsData = result.data;
      if (!channelsData || channelsData.length === 0) {
        // 不抛出错误，而是设置空频道列表
        setCurrentChannels([]);
        setGroupedChannels({});
        setFilteredChannels([]);

        // 更新直播源的频道数为 0
        setLiveSources(prevSources =>
          prevSources.map(s =>
            s.key === source.key ? { ...s, channelNumber: 0 } : s
          )
        );

        setIsVideoLoading(false);
        return;
      }

      // 转换频道数据格式
      const channels: LiveChannel[] = channelsData.map((channel: any) => ({
        id: channel.id,
        tvgId: channel.tvgId || channel.name,
        name: channel.name,
        logo: channel.logo,
        group: channel.group || '其他',
        url: channel.url
      }));

      setCurrentChannels(channels);

      // 更新直播源的频道数
      setLiveSources(prevSources =>
        prevSources.map(s =>
          s.key === source.key ? { ...s, channelNumber: channels.length } : s
        )
      );

      // 默认选中第一个频道
      if (channels.length > 0) {
        setCurrentChannel(channels[0]);
        setVideoUrl(channels[0].url);
      }

      // 按分组组织频道
      const grouped = channels.reduce((acc, channel) => {
        const group = channel.group || '其他';
        if (!acc[group]) {
          acc[group] = [];
        }
        acc[group].push(channel);
        return acc;
      }, {} as { [key: string]: LiveChannel[] });

      setGroupedChannels(grouped);

      // 默认选中第一个分组
      const firstGroup = Object.keys(grouped)[0] || '';
      setSelectedGroup(firstGroup);
      setFilteredChannels(firstGroup ? grouped[firstGroup] : channels);

      setIsVideoLoading(false);
    } catch (err) {
      console.error('获取频道列表失败:', err);
      // 不设置错误，而是设置空频道列表
      setCurrentChannels([]);
      setGroupedChannels({});
      setFilteredChannels([]);

      // 更新直播源的频道数为 0
      setLiveSources(prevSources =>
        prevSources.map(s =>
          s.key === source.key ? { ...s, channelNumber: 0 } : s
        )
      );

      setIsVideoLoading(false);
    }
  };

  // 切换直播源
  const handleSourceChange = async (source: LiveSource) => {
    try {
      // 设置切换状态，锁住频道切换器
      setIsSwitchingSource(true);

      // 清空节目单信息
      setEpgData(null);

      setCurrentSource(source);
      await fetchChannels(source);
    } catch (err) {
      console.error('切换直播源失败:', err);
      // 不设置错误，保持当前状态
    } finally {
      // 切换完成，解锁频道切换器
      setIsSwitchingSource(false);
      // 自动切换到频道 tab
      setActiveTab('channels');
    }
  };

  // 切换频道
  const handleChannelChange = async (channel: LiveChannel) => {
    // 如果正在切换直播源，则禁用频道切换
    if (isSwitchingSource) return;

    setCurrentChannel(channel);
    setVideoUrl(channel.url);

    // 获取节目单信息
    if (channel.tvgId && currentSource) {
      try {
        setIsEpgLoading(true); // 开始加载 EPG 数据
        const response = await fetch(`/api/live/epg?source=${currentSource.key}&tvgId=${channel.tvgId}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // 清洗EPG数据，去除重叠的节目
            const cleanedData = {
              ...result.data,
              programs: cleanEpgData(result.data.programs)
            };
            setEpgData(cleanedData);
          }
        }
      } catch (error) {
        console.error('获取节目单信息失败:', error);
      } finally {
        setIsEpgLoading(false); // 无论成功失败都结束加载状态
      }
    } else {
      // 如果没有 tvgId 或 currentSource，清空 EPG 数据
      setEpgData(null);
      setIsEpgLoading(false);
    }
  };

  // 清理播放器资源的统一函数
  const cleanupPlayer = () => {
    if (artPlayerRef.current) {
      try {
        // 先暂停播放
        if (artPlayerRef.current.video) {
          artPlayerRef.current.video.pause();
          artPlayerRef.current.video.src = '';
          artPlayerRef.current.video.load();
        }

        // 销毁 HLS 实例
        if (artPlayerRef.current.video && artPlayerRef.current.video.hls) {
          artPlayerRef.current.video.hls.destroy();
          artPlayerRef.current.video.hls = null;
        }

        // 销毁 FLV 实例
        if (artPlayerRef.current.video && artPlayerRef.current.video.flv) {
          artPlayerRef.current.video.flv.destroy();
          artPlayerRef.current.video.flv = null;
        }

        // 移除所有事件监听器
        artPlayerRef.current.off('ready');
        artPlayerRef.current.off('loadstart');
        artPlayerRef.current.off('loadeddata');
        artPlayerRef.current.off('canplay');
        artPlayerRef.current.off('waiting');
        artPlayerRef.current.off('error');

        // 销毁 ArtPlayer 实例
        artPlayerRef.current.destroy();
        artPlayerRef.current = null;
      } catch (err) {
        console.warn('清理播放器资源时出错:', err);
        artPlayerRef.current = null;
      }
    }
  };

  // 确保视频源正确设置
  const ensureVideoSource = (video: HTMLVideoElement | null, url: string) => {
    if (!video || !url) return;
    const sources = Array.from(video.getElementsByTagName('source'));
    const existed = sources.some((s) => s.src === url);
    if (!existed) {
      // 移除旧的 source，保持唯一
      sources.forEach((s) => s.remove());
      const sourceEl = document.createElement('source');
      sourceEl.src = url;
      video.appendChild(sourceEl);
    }

    // 始终允许远程播放（AirPlay / Cast）
    video.disableRemotePlayback = false;
    // 如果曾经有禁用属性，移除之
    if (video.hasAttribute('disableRemotePlayback')) {
      video.removeAttribute('disableRemotePlayback');
    }
  };

  // 切换分组
  const handleGroupChange = (group: string) => {
    // 如果正在切换直播源，则禁用分组切换
    if (isSwitchingSource) return;

    setSelectedGroup(group);
    const filtered = currentChannels.filter(channel => channel.group === group);
    setFilteredChannels(filtered);

    // 滚动到频道列表顶端
    if (channelListRef.current) {
      channelListRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // 初始化
  useEffect(() => {
    fetchLiveSources();
  }, []);

  // 当分组切换时，将激活的分组标签滚动到视口中间
  useEffect(() => {
    if (!selectedGroup || !groupContainerRef.current) return;

    const groupKeys = Object.keys(groupedChannels);
    const groupIndex = groupKeys.indexOf(selectedGroup);
    if (groupIndex === -1) return;

    const btn = groupButtonRefs.current[groupIndex];
    const container = groupContainerRef.current;
    if (btn && container) {
      // 手动计算滚动位置，只滚动分组标签容器
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const scrollLeft = container.scrollLeft;

      // 计算按钮相对于容器的位置
      const btnLeft = btnRect.left - containerRect.left + scrollLeft;
      const btnWidth = btnRect.width;
      const containerWidth = containerRect.width;

      // 计算目标滚动位置，使按钮居中
      const targetScrollLeft = btnLeft - (containerWidth - btnWidth) / 2;

      // 平滑滚动到目标位置
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth',
      });
    }
  }, [selectedGroup, groupedChannels]);

  class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
    constructor(config: any) {
      super(config);
      const load = this.load.bind(this);
      this.load = function (context: any, config: any, callbacks: any) {
        // 所有的请求都带一个 source 参数
        try {
          const url = new URL(context.url);
          url.searchParams.set('moontv-source', currentSourceRef.current?.key || '');
          context.url = url.toString();
        } catch (error) {
          // ignore
        }
        // 拦截manifest和level请求
        if (
          (context as any).type === 'manifest' ||
          (context as any).type === 'level'
        ) {
          // 判断是否浏览器直连
          const isLiveDirectConnectStr = localStorage.getItem('liveDirectConnect');
          const isLiveDirectConnect = isLiveDirectConnectStr === 'true';
          if (isLiveDirectConnect) {
            // 浏览器直连，使用 URL 对象处理参数
            try {
              const url = new URL(context.url);
              url.searchParams.set('allowCORS', 'true');
              context.url = url.toString();
            } catch (error) {
              // 如果 URL 解析失败，回退到字符串拼接
              context.url = context.url + '&allowCORS=true';
            }
          }
        }
        // 执行原始load方法
        load(context, config, callbacks);
      };
    }
  }

  function m3u8Loader(video: HTMLVideoElement, url: string) {
    if (!Hls) {
      console.error('HLS.js 未加载');
      return;
    }

    // 清理之前的 HLS 实例
    if (video.hls) {
      try {
        video.hls.destroy();
        video.hls = null;
      } catch (err) {
        console.warn('清理 HLS 实例时出错:', err);
      }
    }

    const hls = new Hls({
      debug: false,
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 30,
      backBufferLength: 30,
      maxBufferSize: 60 * 1000 * 1000,
      loader: CustomHlsJsLoader,
    });

    hls.loadSource(url);
    hls.attachMedia(video);
    video.hls = hls;

    hls.on(Hls.Events.ERROR, function (event: any, data: any) {
      console.error('HLS Error:', event, data);

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            hls.destroy();
            break;
        }
      }
    });
  }

  async function flvLoader(video: HTMLVideoElement, url: string) {
    try {
      const flvjs = await import('flv.js');
      const flv = flvjs.default as any;

      if (!flv.isSupported()) {
        console.error('Flv.js 未支持');
        return;
      }

      if (video.flv) {
        video.flv.destroy();
      }

      const flvPlayer = flv.createPlayer({
        type: 'flv',
        url: url,
      });
      flvPlayer.attachMediaElement(video);
      flvPlayer.load();
      video.flv = flvPlayer;
    } catch (error) {
      console.error('加载 Flv.js 失败:', error);
    }
  }

  // 播放器初始化
  useEffect(() => {
    const preload = async () => {
      if (
        !Artplayer ||
        !Hls ||
        !videoUrl ||
        !artRef.current ||
        !currentChannel
      ) {
        return;
      }

      console.log('视频URL:', videoUrl);

      // 销毁之前的播放器实例并创建新的
      if (artPlayerRef.current) {
        cleanupPlayer();
      }

      // precheck type
      let type = 'm3u8';
      const precheckUrl = `/api/live/precheck?url=${encodeURIComponent(videoUrl)}&moontv-source=${currentSourceRef.current?.key || ''}`;
      const precheckResponse = await fetch(precheckUrl);
      if (!precheckResponse.ok) {
        console.error('预检查失败:', precheckResponse.statusText);
        return;
      }
      const precheckResult = await precheckResponse.json();
      if (precheckResult.success) {
        type = precheckResult.type;
      }

      const customType = type === 'flv' ? {
        flv: flvLoader,
      } : type === 'mp4' ? {} : {
        m3u8: m3u8Loader,
      };
      try {
        // 创建新的播放器实例
        Artplayer.USE_RAF = true;

        artPlayerRef.current = new Artplayer({
          container: artRef.current,
          url: `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}&moontv-source=${currentSourceRef.current?.key || ''}`,
          poster: currentChannel.logo,
          volume: 0.7,
          isLive: true, // 设置为直播模式
          muted: false,
          autoplay: true,
          pip: true,
          autoSize: false,
          autoMini: false,
          screenshot: false,
          setting: false,
          loop: false,
          flip: false,
          playbackRate: false,
          aspectRatio: false,
          fullscreen: true,
          fullscreenWeb: true,
          subtitleOffset: false,
          miniProgressBar: false,
          mutex: true,
          playsInline: true,
          autoPlayback: false,
          airplay: true,
          theme: '#22c55e',
          lang: 'zh-cn',
          hotkey: false,
          fastForward: false, // 直播不需要快进
          autoOrientation: true,
          lock: true,
          moreVideoAttr: {
            crossOrigin: 'anonymous',
            preload: 'metadata',
          },
          type: type,
          customType: customType,
          icons: {
            loading:
              '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDUwIDUwIj48cGF0aCBkPSJNMjUuMjUxIDYuNDYxYy0xMC4zMTggMC0xOC42ODMgOC4zNjUtMTguNjgzIDE4LjY4M2g0LjA2OGMwLTguMDcgNi41NDUtMTQuNjE1IDE0LjYxNS0xNC42MTVWNi40NjF6IiBmaWxsPSIjMDA5Njg4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIGF0dHJpYnV0ZVR5cGU9IlhNTCIgZHVyPSIxcyIgZnJvbT0iMCAyNSAyNSIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIHRvPSIzNjAgMjUgMjUiIHR5cGU9InJvdGF0ZSIvPjwvcGF0aD48L3N2Zz4=">',
          },
        });

        // 监听播放器事件
        artPlayerRef.current.on('ready', () => {
          setError(null);
          setIsVideoLoading(false);

        });

        artPlayerRef.current.on('loadstart', () => {
          setIsVideoLoading(true);
        });

        artPlayerRef.current.on('loadeddata', () => {
          setIsVideoLoading(false);
        });

        artPlayerRef.current.on('canplay', () => {
          setIsVideoLoading(false);
        });

        artPlayerRef.current.on('waiting', () => {
          setIsVideoLoading(true);
        });

        artPlayerRef.current.on('error', (err: any) => {
          console.error('播放器错误:', err);
        });

        if (artPlayerRef.current?.video) {
          const finalUrl = `/api/proxy/m3u8?url=${encodeURIComponent(videoUrl)}`;
          ensureVideoSource(
            artPlayerRef.current.video as HTMLVideoElement,
            finalUrl
          );
        }

      } catch (err) {
        console.error('创建播放器失败:', err);
        // 不设置错误，只记录日志
      }
    }
    preload();
  }, [Artplayer, Hls, videoUrl, currentChannel, loading]);

  // 清理播放器资源
  useEffect(() => {
    return () => {
      cleanupPlayer();
    };
  }, []);

  // 页面卸载时的额外清理
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupPlayer();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupPlayer();
    };
  }, []);

  // 全局快捷键处理
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      // 忽略输入框中的按键事件
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      )
        return;

      // 上箭头 = 音量+
      if (e.key === 'ArrowUp') {
        if (artPlayerRef.current && artPlayerRef.current.volume < 1) {
          artPlayerRef.current.volume =
            Math.round((artPlayerRef.current.volume + 0.1) * 10) / 10;
          artPlayerRef.current.notice.show = `音量: ${Math.round(
            artPlayerRef.current.volume * 100
          )}`;
          e.preventDefault();
        }
      }

      // 下箭头 = 音量-
      if (e.key === 'ArrowDown') {
        if (artPlayerRef.current && artPlayerRef.current.volume > 0) {
          artPlayerRef.current.volume =
            Math.round((artPlayerRef.current.volume - 0.1) * 10) / 10;
          artPlayerRef.current.notice.show = `音量: ${Math.round(
            artPlayerRef.current.volume * 100
          )}`;
          e.preventDefault();
        }
      }

      // 空格 = 播放/暂停
      if (e.key === ' ') {
        if (artPlayerRef.current) {
          artPlayerRef.current.toggle();
          e.preventDefault();
        }
      }

      // f 键 = 切换全屏
      if (e.key === 'f' || e.key === 'F') {
        if (artPlayerRef.current) {
          artPlayerRef.current.fullscreen = !artPlayerRef.current.fullscreen;
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, []);

  if (loading) {
    return (
      <PageLayout activePath='/live'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 动画直播图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>📺</div>
                {/* 旋转光环 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
              </div>

              {/* 浮动粒子效果 */}
              <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                <div
                  className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                  style={{ animationDelay: '0.5s' }}
                ></div>
                <div
                  className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                  style={{ animationDelay: '1s' }}
                ></div>
              </div>
            </div>

            {/* 进度指示器 */}
            <div className='mb-6 w-80 mx-auto'>
              <div className='flex justify-center space-x-2 mb-4'>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'loading' ? 'bg-green-500 scale-125' : 'bg-green-500'
                    }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'fetching' ? 'bg-green-500 scale-125' : 'bg-green-500'
                    }`}
                ></div>
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${loadingStage === 'ready' ? 'bg-green-500 scale-125' : 'bg-gray-300'
                    }`}
                ></div>
              </div>

              {/* 进度条 */}
              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'>
                <div
                  className='h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-1000 ease-out'
                  style={{
                    width:
                      loadingStage === 'loading' ? '33%' : loadingStage === 'fetching' ? '66%' : '100%',
                  }}
                ></div>
              </div>
            </div>

            {/* 加载消息 */}
            <div className='space-y-2'>
              <p className='text-xl font-semibold text-gray-800 dark:text-gray-200 animate-pulse'>
                {loadingMessage}
              </p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout activePath='/live'>
        <div className='flex items-center justify-center min-h-screen bg-transparent'>
          <div className='text-center max-w-md mx-auto px-6'>
            {/* 错误图标 */}
            <div className='relative mb-8'>
              <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                <div className='text-white text-4xl'>😵</div>
                {/* 脉冲效果 */}
                <div className='absolute -inset-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl opacity-20 animate-pulse'></div>
              </div>
            </div>

            {/* 错误信息 */}
            <div className='space-y-4 mb-8'>
              <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
                哎呀，出现了一些问题
              </h2>
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                <p className='text-red-600 dark:text-red-400 font-medium'>
                  {error}
                </p>
              </div>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                请检查网络连接或尝试刷新页面
              </p>
            </div>

            {/* 操作按钮 */}
            <div className='space-y-3'>
              <button
                onClick={() => window.location.reload()}
                className='w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl'
              >
                🔄 重新尝试
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/live'>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 第一行：页面标题 */}
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 max-w-[80%]'>
            <Radio className='w-5 h-5 text-blue-500 flex-shrink-0' />
            <div className='min-w-0 flex-1'>
              <div className='truncate'>
                {currentSource?.name}
                {currentSource && currentChannel && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {` > ${currentChannel.name}`}
                  </span>
                )}
                {currentSource && !currentChannel && (
                  <span className='text-gray-500 dark:text-gray-400'>
                    {` > ${currentSource.name}`}
                  </span>
                )}
              </div>
            </div>
          </h1>
        </div>

        {/* 第二行：播放器和频道列表 */}
        <div className='space-y-2'>
          {/* 折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() =>
                setIsChannelListCollapsed(!isChannelListCollapsed)
              }
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isChannelListCollapsed ? '显示频道列表' : '隐藏频道列表'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isChannelListCollapsed ? 'rotate-180' : 'rotate-0'
                  }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isChannelListCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${isChannelListCollapsed
                  ? 'bg-orange-400 animate-pulse'
                  : 'bg-green-400'
                  }`}
              ></div>
            </button>
          </div>

          <div className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${isChannelListCollapsed
            ? 'grid-cols-1'
            : 'grid-cols-1 md:grid-cols-4'
            }`}>
            {/* 播放器 */}
            <div className={`h-full transition-all duration-300 ease-in-out ${isChannelListCollapsed ? 'col-span-1' : 'md:col-span-3'}`}>
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg border border-white/0 dark:border-white/30'
                ></div>

                {/* 视频加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>📺</div>
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>
                      </div>
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>
                          🔄 IPTV 加载中...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 频道列表 */}
            <div className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${isChannelListCollapsed
              ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
              : 'md:col-span-1 lg:opacity-100 lg:scale-100'
              }`}>
              <div className='md:ml-2 px-4 py-0 h-full rounded-xl bg-black/10 dark:bg-white/5 flex flex-col border border-white/0 dark:border-white/30 overflow-hidden'>
                {/* 主要的 Tab 切换 */}
                <div className='flex mb-1 -mx-6 flex-shrink-0'>
                  <div
                    onClick={() => setActiveTab('channels')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium
                      ${activeTab === 'channels'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'
                      }
                    `.trim()}
                  >
                    频道
                  </div>
                  <div
                    onClick={() => setActiveTab('sources')}
                    className={`flex-1 py-3 px-6 text-center cursor-pointer transition-all duration-200 font-medium
                      ${activeTab === 'sources'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-700 hover:text-green-600 bg-black/5 dark:bg-white/5 dark:text-gray-300 dark:hover:text-green-400 hover:bg-black/3 dark:hover:bg-white/3'
                      }
                    `.trim()}
                  >
                    直播源
                  </div>
                </div>

                {/* 频道 Tab 内容 */}
                {activeTab === 'channels' && (
                  <>
                    {/* 分组标签 */}
                    <div className='flex items-center gap-4 mb-4 border-b border-gray-300 dark:border-gray-700 -mx-6 px-6 flex-shrink-0'>
                      {/* 切换状态提示 */}
                      {isSwitchingSource && (
                        <div className='flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400'>
                          <div className='w-2 h-2 bg-amber-500 rounded-full animate-pulse'></div>
                          切换直播源中...
                        </div>
                      )}

                      <div
                        className='flex-1 overflow-x-auto'
                        ref={groupContainerRef}
                        onMouseEnter={() => {
                          // 鼠标进入分组标签区域时，添加滚轮事件监听
                          const container = groupContainerRef.current;
                          if (container) {
                            const handleWheel = (e: WheelEvent) => {
                              if (container.scrollWidth > container.clientWidth) {
                                e.preventDefault();
                                container.scrollLeft += e.deltaY;
                              }
                            };
                            container.addEventListener('wheel', handleWheel, { passive: false });
                            // 将事件处理器存储在容器上，以便后续移除
                            (container as any)._wheelHandler = handleWheel;
                          }
                        }}
                        onMouseLeave={() => {
                          // 鼠标离开分组标签区域时，移除滚轮事件监听
                          const container = groupContainerRef.current;
                          if (container && (container as any)._wheelHandler) {
                            container.removeEventListener('wheel', (container as any)._wheelHandler);
                            delete (container as any)._wheelHandler;
                          }
                        }}
                      >
                        <div className='flex gap-4 min-w-max'>
                          {Object.keys(groupedChannels).map((group, index) => (
                            <button
                              key={group}
                              ref={(el) => {
                                groupButtonRefs.current[index] = el;
                              }}
                              onClick={() => handleGroupChange(group)}
                              disabled={isSwitchingSource}
                              className={`w-20 relative py-2 text-sm font-medium transition-colors flex-shrink-0 text-center overflow-hidden
                                 ${isSwitchingSource
                                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                                  : selectedGroup === group
                                    ? 'text-green-500 dark:text-green-400'
                                    : 'text-gray-700 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-400'
                                }
                               `.trim()}
                            >
                              <div className='px-1 overflow-hidden whitespace-nowrap' title={group}>
                                {group}
                              </div>
                              {selectedGroup === group && !isSwitchingSource && (
                                <div className='absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 dark:bg-green-400' />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 频道列表 */}
                    <div ref={channelListRef} className='flex-1 overflow-y-auto space-y-2 pb-4'>
                      {filteredChannels.length > 0 ? (
                        filteredChannels.map(channel => {
                          const isActive = channel.id === currentChannel?.id;
                          return (
                            <button
                              key={channel.id}
                              onClick={() => handleChannelChange(channel)}
                              disabled={isSwitchingSource}
                              className={`w-full p-3 rounded-lg text-left transition-all duration-200 ${isSwitchingSource
                                ? 'opacity-50 cursor-not-allowed'
                                : isActive
                                  ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                              <div className='flex items-center gap-3'>
                                <div className='w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                                  {channel.logo ? (
                                    <img
                                      src={`/api/proxy/logo?url=${encodeURIComponent(channel.logo)}&source=${currentSource?.key || ''}`}
                                      alt={channel.name}
                                      className='w-full h-full rounded object-contain'
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Tv className='w-5 h-5 text-gray-500' />
                                  )}
                                </div>
                                <div className='flex-1 min-w-0'>
                                  <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate' title={channel.name}>
                                    {channel.name}
                                  </div>
                                  <div className='text-xs text-gray-500 dark:text-gray-400 mt-1' title={channel.group}>
                                    {channel.group}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className='flex flex-col items-center justify-center py-12 text-center'>
                          <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                            <Tv className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                          </div>
                          <p className='text-gray-500 dark:text-gray-400 font-medium'>
                            暂无可用频道
                          </p>
                          <p className='text-sm text-gray-400 dark:text-gray-500 mt-1'>
                            请选择其他直播源或稍后再试
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 直播源 Tab 内容 */}
                {activeTab === 'sources' && (
                  <div className='flex flex-col h-full mt-4'>
                    <div className='flex-1 overflow-y-auto space-y-2 pb-20'>
                      {liveSources.length > 0 ? (
                        liveSources.map((source) => {
                          const isCurrentSource = source.key === currentSource?.key;
                          return (
                            <div
                              key={source.key}
                              onClick={() => !isCurrentSource && handleSourceChange(source)}
                              className={`flex items-start gap-3 px-2 py-3 rounded-lg transition-all select-none duration-200 relative
                                ${isCurrentSource
                                  ? 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30 border'
                                  : 'hover:bg-gray-200/50 dark:hover:bg-white/10 hover:scale-[1.02] cursor-pointer'
                                }`.trim()}
                            >
                              {/* 图标 */}
                              <div className='w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0'>
                                <Radio className='w-6 h-6 text-gray-500' />
                              </div>

                              {/* 信息 */}
                              <div className='flex-1 min-w-0'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                  {source.name}
                                </div>
                                <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                                  {!source.channelNumber || source.channelNumber === 0 ? '-' : `${source.channelNumber} 个频道`}
                                </div>
                              </div>

                              {/* 当前标识 */}
                              {isCurrentSource && (
                                <div className='absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full'></div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className='flex flex-col items-center justify-center py-12 text-center'>
                          <div className='w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4'>
                            <Radio className='w-8 h-8 text-gray-400 dark:text-gray-600' />
                          </div>
                          <p className='text-gray-500 dark:text-gray-400 font-medium'>
                            暂无可用直播源
                          </p>
                          <p className='text-sm text-gray-400 dark:text-gray-500 mt-1'>
                            请检查网络连接或联系管理员添加直播源
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 当前频道信息 */}
        {currentChannel && (
          <div className='pt-4'>
            <div className='flex flex-col lg:flex-row gap-4'>
              {/* 频道图标+名称 - 在小屏幕上占100%，大屏幕占20% */}
              <div className='w-full flex-shrink-0'>
                <div className='flex items-center gap-4'>
                  <div className='w-20 h-20 bg-gray-300 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'>
                    {currentChannel.logo ? (
                      <img
                        src={`/api/proxy/logo?url=${encodeURIComponent(currentChannel.logo)}&source=${currentSource?.key || ''}`}
                        alt={currentChannel.name}
                        className='w-full h-full rounded object-contain'
                        loading="lazy"
                      />
                    ) : (
                      <Tv className='w-10 h-10 text-gray-500' />
                    )}
                  </div>
                  <div className='flex-1 min-w-0'>
                    <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 truncate'>
                      {currentChannel.name}
                    </h3>
                    <p className='text-sm text-gray-500 dark:text-gray-400 truncate'>
                      {currentSource?.name} {' > '} {currentChannel.group}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* EPG节目单 */}
            <EpgScrollableRow
              programs={epgData?.programs || []}
              currentTime={new Date()}
              isLoading={isEpgLoading}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LivePageClient />
    </Suspense>
  );
}
