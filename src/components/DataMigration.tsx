/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { AlertTriangle, Download, FileCheck, Lock, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import Swal from 'sweetalert2';

interface DataMigrationProps {
  onRefreshConfig?: () => Promise<void>;
}

const DataMigration = ({ onRefreshConfig }: DataMigrationProps) => {
  const [exportPassword, setExportPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 导出数据
  const handleExport = async () => {
    if (!exportPassword.trim()) {
      Swal.fire({
        icon: 'error',
        title: '错误',
        text: '请输入加密密码',
        returnFocus: false,
      });
      return;
    }

    try {
      setIsExporting(true);

      const response = await fetch('/api/admin/data_migration/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: exportPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `导出失败: ${response.status}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 'moontv-backup.dat';

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      a.style.position = 'fixed';
      a.style.top = '0';
      a.style.left = '0';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      Swal.fire({
        icon: 'success',
        title: '导出成功',
        text: '数据已成功导出，请妥善保管备份文件和密码',
        timer: 3000,
        showConfirmButton: false,
        returnFocus: false,
      });

      setExportPassword('');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '导出失败',
        text: error instanceof Error ? error.message : '导出过程中发生错误',
        returnFocus: false,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 文件选择处理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // 导入数据
  const handleImport = async () => {
    if (!selectedFile) {
      Swal.fire({
        icon: 'error',
        title: '错误',
        text: '请选择备份文件',
        returnFocus: false,
      });
      return;
    }

    if (!importPassword.trim()) {
      Swal.fire({
        icon: 'error',
        title: '错误',
        text: '请输入解密密码',
        returnFocus: false,
      });
      return;
    }

    try {
      setIsImporting(true);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('password', importPassword);

      const response = await fetch('/api/admin/data_migration/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `导入失败: ${response.status}`);
      }

      await Swal.fire({
        icon: 'success',
        title: '导入成功',
        html: `
          <div class="text-left">
            <p><strong>导入完成！</strong></p>
            <p class="mt-2">导入的用户数量: ${result.importedUsers}</p>
            <p>备份时间: ${new Date(result.timestamp).toLocaleString('zh-CN')}</p>
            <p>服务器版本: ${result.serverVersion || '未知版本'}</p>
            <p class="mt-3 text-orange-600">请刷新页面以查看最新数据。</p>
          </div>
        `,
        confirmButtonText: '刷新页面',
        returnFocus: false,
      });

      // 清理状态
      setSelectedFile(null);
      setImportPassword('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 刷新配置
      if (onRefreshConfig) {
        await onRefreshConfig();
      }

      // 刷新页面
      window.location.reload();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '导入失败',
        text: error instanceof Error ? error.message : '导入过程中发生错误',
        returnFocus: false,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 简洁警告提示 */}
      <div className="flex items-center gap-3 p-4 border border-amber-200 dark:border-amber-700 rounded-lg bg-amber-50/30 dark:bg-amber-900/5">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          数据迁移操作请谨慎，确保已备份重要数据
        </p>
      </div>

      {/* 主要操作区域 - 响应式布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 数据导出 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">数据导出</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">创建加密备份文件</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              {/* 密码输入 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Lock className="w-4 h-4" />
                  加密密码
                </label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  placeholder="设置强密码保护备份文件"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={isExporting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  导入时需要使用相同密码
                </p>
              </div>

              {/* 备份内容列表 */}
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">备份内容：</p>
                <div className="grid grid-cols-2 gap-1">
                  <div>• 管理配置</div>
                  <div>• 用户数据</div>
                  <div>• 播放记录</div>
                  <div>• 收藏夹</div>
                </div>
              </div>
            </div>

            {/* 导出按钮 */}
            <button
              onClick={handleExport}
              disabled={isExporting || !exportPassword.trim()}
              className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors mt-10 ${isExporting || !exportPassword.trim()
                ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {isExporting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  导出中...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  导出数据
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 数据导入 */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <Upload className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">数据导入</h3>
              <p className="text-sm text-red-600 dark:text-red-400">⚠️ 将清空现有数据</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              {/* 文件选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FileCheck className="w-4 h-4" />
                  备份文件
                  {selectedFile && (
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-normal">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dat"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-50 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-100 dark:hover:file:bg-gray-500 transition-colors"
                  disabled={isImporting}
                />
              </div>

              {/* 密码输入 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Lock className="w-4 h-4" />
                  解密密码
                </label>
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="输入导出时的加密密码"
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  disabled={isImporting}
                />
              </div>
            </div>

            {/* 导入按钮 */}
            <button
              onClick={handleImport}
              disabled={isImporting || !selectedFile || !importPassword.trim()}
              className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors mt-10 ${isImporting || !selectedFile || !importPassword.trim()
                ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
            >
              {isImporting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  导入中...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  导入数据
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataMigration;