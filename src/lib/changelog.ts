// 此文件由 scripts/convert-changelog.js 自动生成
// 请勿手动编辑

export interface ChangelogEntry {
  version: string;
  date: string;
  added: string[];
  changed: string[];
  fixed: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "2.6.0",
    date: "2025-08-17",
    added: [
    "新增搜索流式输出接口，并设置流式搜索为默认搜索接口，优化搜索体验",
    "新增源站搜索结果内存缓存，粒度为源站+关键词+页数，缓存 10 分钟",
    "新增豆瓣 CDN provided by @JohnsonRan"
    ],
    changed: [
    "搜索结果默认为无排序状态，不再默认按照年份排序",
    "常规搜索接口无结果时，不再设置响应的缓存头",
    "移除豆瓣数据源中的 cors-anywhere 方式"
    ],
    fixed: [
    "数据导出时导出站长密码，保证迁移到新账户时原站长用户可正常登录",
    "聚合卡片优化移动端源信息展示"
    ]
  },
  {
    version: "2.4.1",
    date: "2025-08-15",
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "对导入和 db 读取的配置文件做自检，防止 USERNAME 修改导致用户状态异常"
    ]
  },
  {
    version: "2.4.0",
    date: "2025-08-15",
    added: [
    "支持 kvrocks 存储（持久化 kv 存储）"
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复搜索结果排序不稳定的问题",
    "导入数据时同时更新内存缓存的管理员配置"
    ]
  },
  {
    version: "2.3.0",
    date: "2025-08-15",
    added: [
    "支持站长导入导出整站数据"
    ],
    changed: [
    "仅允许站长操作配置文件",
    "微调搜索结果过滤面板的移动端样式"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "2.2.1",
    date: "2025-08-14",
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复了筛选 panel 打开时滚动页面 panel 不跟随的问题"
    ]
  },
  {
    version: "2.2.0",
    date: "2025-08-14",
    added: [
    "搜索结果支持按播放源、标题和年份筛选，支持按年份排序",
    "搜索界面视频卡片展示年份信息，聚合卡片展示播放源"
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复 /api/search/resources 返回空的问题",
    "修复 upstash 实例无法编辑自定义分类的问题"
    ]
  },
  {
    version: "2.1.0",
    date: "2025-08-13",
    added: [
    "支持通过订阅获取配置文件"
    ],
    changed: [
    "微调部分文案和 UI",
    "删除部分无用代码"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "2.0.1",
    date: "2025-08-13",
    added: [
      // 无新增内容
    ],
    changed: [
    "版本检查和变更日志请求 Github"
    ],
    fixed: [
    "微调管理面板样式"
    ]
  },
  {
    version: "2.0.0",
    date: "2025-08-13",
    added: [
    "支持配置文件在线配置和编辑",
    "搜索页搜索框实时联想",
    "去除对 localstorage 模式的支持"
    ],
    changed: [
    "播放记录删除按钮改为垃圾桶图标以消除歧义"
    ],
    fixed: [
    "限制设置面板的最大长度，防止超出视口"
    ]
  },
  {
    version: "1.1.1",
    date: "2025-08-12",
    added: [
      // 无新增内容
    ],
    changed: [
    "修正 zwei 提供的 cors proxy 地址",
    "移除废弃代码"
    ],
    fixed: [
    "[运维] docker workflow release 日期使用东八区日期"
    ]
  },
  {
    version: "1.1.0",
    date: "2025-08-12",
    added: [
    "每日新番放送功能，展示每日新番放送的番剧"
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复远程 CHANGELOG 无法提取变更内容的问题"
    ]
  },
  {
    version: "1.0.5",
    date: "2025-08-12",
    added: [
      // 无新增内容
    ],
    changed: [
    "实现基于 Git 标签的自动 Release 工作流"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "1.0.4",
    date: "2025-08-11",
    added: [
    "优化版本管理工作流，实现单点修改"
    ],
    changed: [
    "版本号现在从 CHANGELOG 自动提取，无需手动维护 VERSION.txt"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "1.0.3",
    date: "2025-08-11",
    added: [
      // 无新增内容
    ],
    changed: [
    "升级播放器 Artplayer 至版本 5.2.5"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "1.0.2",
    date: "2025-08-11",
    added: [
      // 无新增内容
    ],
    changed: [
    "版本号比较机制恢复为数字比较，仅当最新版本大于本地版本时才认为有更新",
    "[运维] 自动替换 version.ts 中的版本号为 VERSION.txt 中的版本号"
    ],
    fixed: [
      // 无修复内容
    ]
  },
  {
    version: "1.0.1",
    date: "2025-08-11",
    added: [
      // 无新增内容
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
    "修复版本检查功能，只要与最新版本号不一致即认为有更新"
    ]
  },
  {
    version: "1.0.0",
    date: "2025-08-10",
    added: [
    "基于 Semantic Versioning 的版本号机制",
    "版本信息面板，展示本地变更日志和远程更新日志"
    ],
    changed: [
      // 无变更内容
    ],
    fixed: [
      // 无修复内容
    ]
  }
];

export default changelog;
