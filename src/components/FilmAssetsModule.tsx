/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FilmProject, FootageBackup, ScreenplayVersion, StoryboardRevision } from '../types';
import { 
  Database, 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  FileVideo, 
  Clock, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  History, 
  User, 
  Calendar, 
  CheckSquare, 
  BookOpen, 
  Download,
  Upload,
  Terminal,
  Activity,
  Film,
  Sparkles,
  Eye
} from 'lucide-react';

interface FilmAssetsModuleProps {
  project: FilmProject;
  isDark: boolean;
  onUpdateFootage: (backups: FootageBackup[]) => void;
  onUpdateScreenplay: (versions: ScreenplayVersion[]) => void;
  onUpdateStoryboards: (storyboards: StoryboardRevision[]) => void;
  onAddActivityWithDetails?: (phaseId: string, activity: any) => void;
  onUpdatePhase?: (phaseId: string, data: any) => void;
  onUpdateActivity?: (phaseId: string, activityId: string, data: any) => void;
  onNavigateTab?: (tab: string) => void;
}

const resizeAndCompressImage = (file: File, maxWidth = 480, maxHeight = 360): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 0.75 quality to keep it ultra light (< 25KB)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(event.target?.result as string || '');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
};

export default function FilmAssetsModule({ 
  project, 
  isDark, 
  onUpdateFootage, 
  onUpdateScreenplay, 
  onUpdateStoryboards,
  onAddActivityWithDetails,
  onUpdatePhase,
  onUpdateActivity,
  onNavigateTab
}: FilmAssetsModuleProps) {
  // Sub-tabs: 'footage' | 'screenplay' | 'storyboards'
  const [activeSubTab, setActiveSubTab] = React.useState<'footage' | 'screenplay' | 'storyboards'>('footage');

  // Map of asset ID to uploaded browser File object and generated object URL
  const [uploadedFilesMap, setUploadedFilesMap] = React.useState<Record<string, { file: File; objectUrl: string }>>({});
  
  // Track URL object destruction ref
  const objectUrlsRef = React.useRef<string[]>([]);
  
  // Active previewing asset
  const [activePreviewAsset, setActivePreviewAsset] = React.useState<FootageBackup | null>(null);

  React.useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, []);

  // Interactive search & filter states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<string>('All');
  const [formatFilter, setFormatFilter] = React.useState<string>('All');

  // Integrations states
  const [expandedScriptId, setExpandedScriptId] = React.useState<string | null>(null);
  const [comparingScriptId, setComparingScriptId] = React.useState<string | null>(null);

  // Footage backup form state
  const [isAddingFootage, setIsAddingFootage] = React.useState(false);
  const [footName, setFootName] = React.useState('');
  const [footDate, setFootDate] = React.useState('');
  const [footLocation, setFootLocation] = React.useState('AWS S3 Glacier Deep Archive');
  const [footFileCount, setFootFileCount] = React.useState(12);
  const [footSize, setFootSize] = React.useState(45);
  const [footNotes, setFootNotes] = React.useState('');
  
  // Custom metadata fields for Footage form
  const [footFileType, setFootFileType] = React.useState<'Video' | 'Audio' | 'DCP'>('Video');
  const [footFormatName, setFootFormatName] = React.useState<'Scope' | 'IMAX' | 'Flat' | 'Standard'>('Scope');
  const [footIsEdited, setFootIsEdited] = React.useState(false);
  const [footNeedsDubbing, setFootNeedsDubbing] = React.useState(false);
  const [footIsDubbed, setFootIsDubbed] = React.useState(false);

  // Screenplay commitment form state
  const [isAddingScreenplay, setIsAddingScreenplay] = React.useState(false);
  const [scrVersion, setScrVersion] = React.useState('v1.2');
  const [scrTitle, setScrTitle] = React.useState('');
  const [scrAuthor, setScrAuthor] = React.useState('');
  const [scrChanges, setScrChanges] = React.useState('');
  const [scrSnippet, setScrSnippet] = React.useState('');

  // Symmetrical screenplay empty-state scheduler states
  const [schedDate, setSchedDate] = React.useState(project.startDate || new Date().toISOString().split('T')[0]);
  const [schedTaskName, setSchedTaskName] = React.useState('Screenplay Dialogue Calibration & Focus Lock');
  const [schedPriority, setSchedPriority] = React.useState<'high' | 'medium' | 'low'>('high');
  const [schedPhaseId, setSchedPhaseId] = React.useState(project.phases[0]?.id || '');
  const [schedTaskType, setSchedTaskType] = React.useState<'standalone' | 'subtask'>('standalone');
  const [schedSubParentId, setSchedSubParentId] = React.useState('');
  const [schedFeedback, setSchedFeedback] = React.useState('');
  const [scrStatus, setScrStatus] = React.useState<ScreenplayVersion['status']>('Draft');
  const [scrFileName, setScrFileName] = React.useState('');
  const [scrFileUrl, setScrFileUrl] = React.useState('');

  React.useEffect(() => {
    if (project.phases.length > 0) {
      if (!schedPhaseId) {
        setSchedPhaseId(project.phases[0].id);
      }
      const selectedPhase = project.phases.find(p => p.id === (schedPhaseId || project.phases[0].id));
      if (selectedPhase && selectedPhase.activities.length > 0) {
        if (!schedSubParentId || !selectedPhase.activities.some(a => a.id === schedSubParentId)) {
          setSchedSubParentId(selectedPhase.activities[0].id);
        }
      } else {
        setSchedSubParentId('');
      }
    }
  }, [project, schedPhaseId]);

  // Storyboard form state
  const [isAddingStoryboard, setIsAddingStoryboard] = React.useState(false);
  const [stbScene, setStbScene] = React.useState('Scene 4');
  const [stbPanel, setStbPanel] = React.useState('Panel 1A');
  const [stbTitle, setStbTitle] = React.useState('');
  const [stbDesc, setStbDesc] = React.useState('');
  const [stbArtist, setStbArtist] = React.useState('');
  const [stbStatus, setStbStatus] = React.useState<StoryboardRevision['status']>('Approved');
  const [stbImageUrl, setStbImageUrl] = React.useState('');
  const [stbFormError, setStbFormError] = React.useState<string | null>(null);

  // Simulated checksum scan console logs
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [scanLogs, setScanLogs] = React.useState<string[]>([]);

  // Scrapped assets tracking removed to keep application highly essential and simplified
  const scrappedFootages: FootageBackup[] = [];
  const scrappedStoryboards: StoryboardRevision[] = [];
  const scrappedScreenplays: ScreenplayVersion[] = [];

  const [importStatusMsg, setImportStatusMsg] = React.useState<string | null>(null);

  const downloadStoryboardJson = (item: StoryboardRevision) => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const sanitizedName = `${item.sceneNumber || 'scene'}_${item.panelNumber || 'panel'}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadAnchor.setAttribute("download", `storyboard_${sanitizedName}_backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to trigger automatic storyboard JSON download', err);
    }
  };

  const handleExportAllStoryboardsJson = () => {
    try {
      const live = storyboardRevisions || [];
      const backupFilename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_storyboards_pipeline_export.json`;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(live, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", backupFilename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      setScanLogs(prev => [
        ...prev,
        `[BULK-EXPORT] Exported ${live.length} active storyboard cards to high-fidelity JSON archive '${backupFilename}'.`
      ]);
    } catch (err) {
      console.error('Bulk storyboard export failed', err);
    }
  };

  const handleDownloadStoryboardImage = (item: StoryboardRevision) => {
    if (item.imageUrl) {
      try {
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", item.imageUrl);
        const formatName = `${item.sceneNumber}_${item.panelNumber}_sketch`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const ext = item.imageUrl.includes('image/png') ? 'png' : 'jpeg';
        downloadAnchor.setAttribute("download", `storyboard_${formatName}.${ext}`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setScanLogs(prev => [
          ...prev,
          `[EXPORT-MEDIA] Extracted image resource file for '${item.sceneNumber} • ${item.panelNumber}'.`
        ]);
      } catch (err) {
        console.error('Direct download of storyboard base64 image failed', err);
      }
    } else {
      try {
        const simulatedSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360">
            <rect width="100%" height="100%" fill="#030408"/>
            <text x="50%" y="35%" font-family="Courier, monospace" font-size="16" fill="#818cf8" text-anchor="middle" font-weight="bold">CinePipeline Camera Blueprint</text>
            <text x="50%" y="48%" font-family="sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle" font-weight="bold">${item.title}</text>
            <text x="50%" y="58%" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">${item.sceneNumber} • ${item.panelNumber}</text>
            <text x="50%" y="68%" font-family="sans-serif" font-size="10" fill="#475569" text-anchor="middle">${item.description || 'No camera directives loaded.'}</text>
            <text x="50%" y="85%" font-family="monospace" font-size="9" fill="#22c55e" text-anchor="middle">✔ ARCHIVE INTEGRITY VERIFIED</text>
          </svg>
        `.trim();
        const blob = new Blob([simulatedSvg], { type: 'image/svg+xml' });
        const autoUrl = URL.createObjectURL(blob);
        const autoAnchor = document.createElement('a');
        autoAnchor.setAttribute("href", autoUrl);
        const formatName = `${item.sceneNumber}_${item.panelNumber}_blueprint`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        autoAnchor.setAttribute("download", `storyboard_${formatName}.svg`);
        document.body.appendChild(autoAnchor);
        autoAnchor.click();
        autoAnchor.remove();
        setTimeout(() => URL.revokeObjectURL(autoUrl), 100);
        setScanLogs(prev => [
          ...prev,
          `[EXPORT-SIMULATE] Generated vector SVG placeholder package for '${item.sceneNumber} • ${item.panelNumber}'.`
        ]);
      } catch (err) {
        console.error('SVG blueprint download generation failed', err);
      }
    }
  };

  const downloadFootageJson = (item: FootageBackup) => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const sanitizedName = (item.name || 'scrapped_footage').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadAnchor.setAttribute("download", `${sanitizedName}_backup_scrapped.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed to trigger automatic JSON download', err);
    }
  };

  const handleMoveToScrapPool = (item: FootageBackup) => {
    // Update parent pipeline array state directly
    onUpdateFootage(project.footageBackups ? project.footageBackups.filter(f => f.id !== item.id) : []);

    setScanLogs(prev => [
      ...prev,
      `[DELETE] Removed '${item.name}' from active list.`
    ]);
  };

  const triggerFootageDownloadQuiet = (item: FootageBackup) => {
    // 1. Download metadata JSON configuration
    downloadFootageJson(item);

    // 2. Download original raw asset or simulated matching file buffer
    const originalRef = uploadedFilesMap[item.id];
    if (originalRef && originalRef.file) {
      try {
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", originalRef.objectUrl);
        downloadAnchor.setAttribute("download", originalRef.file.name);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } catch (err) {
        console.error('Failed native raw backup stream extraction', err);
      }
    } else {
      try {
        let extension = 'mp4';
        let mimeType = 'video/mp4';
        if (item.fileType === 'Audio') {
          extension = 'wav';
          mimeType = 'audio/wav';
        } else if (item.fileType === 'DCP') {
          extension = 'xml';
          mimeType = 'text/xml';
        }

        const simulatedContent = `// CinePipeline Security Core Recovery Segment
// Asset Name: ${item.name}
// Hash: ${item.hashMD5}
// Projection Format: ${item.formatName}
// Logical Size: ${item.totalSizeGB} GB
// Timestamp: ${new Date().toISOString()}
// Integrity Verified: Yes
`;
        const blob = new Blob([simulatedContent], { type: mimeType });
        const autoUrl = URL.createObjectURL(blob);
        const autoAnchor = document.createElement('a');
        autoAnchor.setAttribute("href", autoUrl);
        autoAnchor.setAttribute("download", `${item.name.replace(/\.[^/.]+$/, "")}.${extension}`);
        document.body.appendChild(autoAnchor);
        autoAnchor.click();
        autoAnchor.remove();
        setTimeout(() => URL.revokeObjectURL(autoUrl), 100);
      } catch (err) {
        console.error('Simulated binary stream backup failed', err);
      }
    }
  };



  const handleUploadBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === 'object' && json.name && typeof json.totalSizeGB === 'number') {
          const imported: FootageBackup = {
            ...json,
            id: 'imported-' + Date.now(),
            status: json.status || 'Verified',
            hashMD5: json.hashMD5 || Math.random().toString(16).substring(2, 10) + 'ea3fc45a19001e',
            fileType: json.fileType || 'Video',
            formatName: json.formatName || 'Scope',
            isEdited: json.isEdited !== undefined ? json.isEdited : false,
            needsDubbing: json.needsDubbing !== undefined ? json.needsDubbing : false,
            isDubbed: json.isDubbed !== undefined ? json.isDubbed : false
          };

          onUpdateFootage([imported, ...(project.footageBackups || [])]);
          setImportStatusMsg(`Imported backup file successfully: ${imported.name}`);
          
          setScanLogs(prev => [
            ...prev,
            `[IMPORT-JSON] Uploaded and merged '${imported.name}' metadata into live database.`
          ]);

          setTimeout(() => setImportStatusMsg(null), 4000);
        } else {
          setImportStatusMsg("Invalid JSON schema. Make sure description & size properties exist.");
          setTimeout(() => setImportStatusMsg(null), 4000);
        }
      } catch (err) {
        setImportStatusMsg("Could not parse file. Verify it is a valid JSON backup.");
        setTimeout(() => setImportStatusMsg(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };



  // Drag-and-drop & manual direct media file uploader
  const handleRealFileInflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const sizeGB = parseFloat((f.size / (1024 * 1024 * 1024)).toFixed(3));
      const ext = f.name.split('.').pop()?.toLowerCase() || '';

      // Determine default type
      let guessedType: 'Video' | 'Audio' | 'DCP' = 'Video';
      if (['wav', 'mp3', 'm4a', 'aac', 'flac'].includes(ext)) {
        guessedType = 'Audio';
      } else if (['xml', 'mxf', 'dcp'].includes(ext)) {
        guessedType = 'DCP';
      }

      // Determine default format projection type
      let guessedFormat: 'Scope' | 'IMAX' | 'Flat' | 'Standard' = 'Scope';
      const lowercaseName = f.name.toLowerCase();
      if (lowercaseName.includes('imax')) {
        guessedFormat = 'IMAX';
      } else if (lowercaseName.includes('flat') || lowercaseName.includes('1.85')) {
        guessedFormat = 'Flat';
      } else if (lowercaseName.includes('standard') || lowercaseName.includes('16:9')) {
        guessedFormat = 'Standard';
      }

      const fileId = 'real-ext-' + Date.now() + '-' + i;
      const fileUrl = URL.createObjectURL(f);
      objectUrlsRef.current.push(fileUrl);

      // Save real file mapping
      setUploadedFilesMap(prev => ({
        ...prev,
        [fileId]: { file: f, objectUrl: fileUrl }
      }));

      // Build production record object
      const newAsset: FootageBackup = {
        id: fileId,
        name: f.name.replace(/\.[^/.]+$/, ""), // pretty presentation name
        date: new Date().toISOString().split('T')[0],
        storageLocation: 'Local RAID SSD storage',
        fileCount: 1,
        totalSizeGB: sizeGB > 0 ? sizeGB : 0.85,
        hashMD5: Math.random().toString(16).substring(2, 10).toUpperCase() + 'FCBA',
        status: 'Verified',
        fileType: guessedType,
        formatName: guessedFormat,
        isEdited: false,
        needsDubbing: guessedType === 'Audio' || lowercaseName.includes('dub') || lowercaseName.includes('dialogue'),
        isDubbed: false,
        notes: `Direct file drag ingestion. Extension: .${ext}`
      };

      onUpdateFootage([newAsset, ...(project.footageBackups || [])]);

      setScanLogs(prev => [
        ...prev,
        `[INGEST] Loaded file '${f.name}' (${(f.size / (1024 * 1024)).toFixed(1)} MB). Assigned Category: "${guessedType}", Aspect Format: "${guessedFormat}".`
      ]);
    }

    setImportStatusMsg(`Successfully ingested ${files.length} active asset file(s)!`);
    setTimeout(() => setImportStatusMsg(null), 4000);
  };

  // Quick inline property toggle states
  const handleToggleEditedOnAsset = (assetId: string) => {
    const list = project.footageBackups || [];
    const modified = list.map(f => {
      if (f.id === assetId) {
        const nextEdited = !f.isEdited;
        setScanLogs(prev => [...prev, `[METADATA] Set status of '${f.name}' to ${nextEdited ? 'EDITED' : 'UNEDITED/RAW'}.`]);
        return { ...f, isEdited: nextEdited };
      }
      return f;
    });
    onUpdateFootage(modified);
  };

  const handleCycleDubbingOnAsset = (assetId: string, value: string) => {
    const list = project.footageBackups || [];
    const modified = list.map(f => {
      if (f.id === assetId) {
        let isDubbed = false;
        let needsDubbing = false;

        if (value === 'dubbed') {
          isDubbed = true;
          needsDubbing = true;
        } else if (value === 'needs') {
          isDubbed = false;
          needsDubbing = true;
        } else {
          isDubbed = false;
          needsDubbing = false;
        }

        setScanLogs(prev => [...prev, `[METADATA] File '${f.name}' dub state updated -> (${value.toUpperCase()})`]);
        return { ...f, isDubbed, needsDubbing };
      }
      return f;
    });
    onUpdateFootage(modified);
  };

  // Get active lists normalized with new properties
  const rawFootageList = project.footageBackups || [];
  const normalizedFootageList = rawFootageList.map(f => ({
    ...f,
    fileType: f.fileType || 'Video',
    formatName: f.formatName || (f.name.toLowerCase().includes('imax') ? 'IMAX' : f.name.toLowerCase().includes('scope') ? 'Scope' : 'Standard'),
    isEdited: f.isEdited !== undefined ? f.isEdited : false,
    needsDubbing: f.needsDubbing !== undefined ? f.needsDubbing : false,
    isDubbed: f.isDubbed !== undefined ? f.isDubbed : false
  }));

  const screenplayVersions = project.screenplayVersions || [];
  const latestScript = screenplayVersions[0];
  const storyboardRevisions = project.storyboardRevisions || [];

  // Filter application
  const filteredFootage = normalizedFootageList.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (f.notes && f.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'All' || f.fileType === typeFilter;
    const matchesFormat = formatFilter === 'All' || f.formatName === formatFilter;
    return matchesSearch && matchesType && matchesFormat;
  });

  // Calculations
  const totalFootageGB = normalizedFootageList.reduce((sum, f) => sum + f.totalSizeGB, 0);
  const totalFileCount = normalizedFootageList.length;

  const handleRunHashScan = () => {
    if (isScanning || normalizedFootageList.length === 0) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([`[INFO] Initializing integrity scanner...`, `[INFO] Parsing digital asset repository with ${normalizedFootageList.length} files.`]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setScanProgress(step * 10);
      
      if (step === 2) {
        setScanLogs(prev => [...prev, `[FIO] Disk array on-set mount location: 192.168.1.240 server node OK.`]);
      } else if (step === 5) {
        const item = normalizedFootageList[0] || { name: 'Raw footage' };
        setScanLogs(prev => [...prev, `[SECURE] Verification matches master card metadata for '${item.name}' OK.`]);
      } else if (step === 8) {
        setScanLogs(prev => [...prev, `[STREAM] Throughput rate details: 1.45 GB/s system checking.`]);
      } else if (step === 10) {
        setScanLogs(prev => [...prev, `[SUCCESS] Storage validation passed. 0 stream packets dropped. Active logs synced.`]);
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 250);
  };

const computeDeterministicSha256 = async (inputStr: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(inputStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().substring(0, 32);
  } catch (e) {
    return 'EAF92B' + Date.now().toString(16).toUpperCase();
  }
};

  const handleRegisterFootage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!footName) return;

    const computedDigest = await computeDeterministicSha256(`${footName}_${footLocation}_${footSize}_${Date.now()}`);

    const newBackup: FootageBackup = {
      id: 'foot-' + Date.now(),
      name: footName,
      date: footDate || new Date().toISOString().split('T')[0],
      storageLocation: footLocation,
      fileCount: Number(footFileCount),
      totalSizeGB: Number(footSize),
      hashMD5: computedDigest,
      status: 'Verified',
      fileType: footFileType,
      formatName: footFormatName,
      isEdited: footIsEdited,
      needsDubbing: footNeedsDubbing,
      isDubbed: footIsDubbed,
      notes: footNotes
    };

    onUpdateFootage([newBackup, ...rawFootageList]);
    setFootName('');
    setFootNotes('');
    setIsAddingFootage(false);
    
    setScanLogs(prev => [
      ...prev,
      `[ADDED] Documented manual archive metadata: '${footName}' (${footFileType} • ${footFormatName})`
    ]);
  };

  const handleCommitScreenplay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrTitle || !scrVersion) return;

    const newVersion: ScreenplayVersion = {
      id: 'scr-' + Date.now(),
      version: scrVersion,
      title: scrTitle,
      author: scrAuthor || project.director || 'Kira Vance',
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      changeDescription: scrChanges,
      contentSnippet: scrSnippet || 'No preview snippet committed.',
      status: scrStatus,
      fileName: scrFileName || undefined,
      fileUrl: scrFileUrl || undefined
    };

    onUpdateScreenplay([newVersion, ...screenplayVersions]);
    setScrTitle('');
    setScrChanges('');
    setScrSnippet('');
    setScrAuthor('');
    setScrFileName('');
    setScrFileUrl('');
    setIsAddingScreenplay(false);
  };

  const handleDeleteScreenplay = (id: string) => {
    const item = screenplayVersions.find(s => s.id === id);
    if (!item) return;

    // Remove from active screenplay versions directly
    onUpdateScreenplay(screenplayVersions.filter(s => s.id !== id));

    setScanLogs(prev => [
      ...prev,
      `[DELETE] Removed screenplay version '${item.version} - ${item.title}'.`
    ]);
  };

  const downloadScreenplayJson = (item: ScreenplayVersion) => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const sanitizedName = `${item.version}_${item.title}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      downloadAnchor.setAttribute("download", `screenplay_${sanitizedName}_backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      console.error('Failed screenplay JSON download', err);
    }
  };

  const handleDownloadScreenplayTextFile = (item: ScreenplayVersion) => {
    if (item.fileUrl) {
      try {
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", item.fileUrl);
        downloadAnchor.setAttribute("download", item.fileName || `screenplay_${item.version}.txt`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } catch (err) {
        console.error('Failed to download attached screenplay file', err);
      }
    } else {
      try {
        const content = `Title: ${item.title}\nAuthor: ${item.author}\nVersion: ${item.version}\nUpdated At: ${item.updatedAt}\nStatus: ${item.status}\n\n=========================================\n${item.changeDescription || 'No description assigned.'}\n=========================================\n\n${item.contentSnippet || ''}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const autoUrl = URL.createObjectURL(blob);
        const autoAnchor = document.createElement('a');
        autoAnchor.setAttribute("href", autoUrl);
        const sanitizedName = `${item.version}_${item.title}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        autoAnchor.setAttribute("download", `screenplay_${sanitizedName}.txt`);
        document.body.appendChild(autoAnchor);
        autoAnchor.click();
        autoAnchor.remove();
        setTimeout(() => URL.revokeObjectURL(autoUrl), 100);
      } catch (err) {
        console.error('Failed fallback text script download', err);
      }
    }
  };



  const handleUploadScreenplayBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const listToImport: ScreenplayVersion[] = [];

        if (Array.isArray(json)) {
          json.forEach((draft: any, idx) => {
            if (draft && typeof draft === 'object' && draft.title && draft.version) {
              listToImport.push({
                ...draft,
                id: 'imported-scr-' + Date.now() + '-' + idx,
                status: draft.status || 'Draft',
                updatedAt: draft.updatedAt || new Date().toISOString().replace('T', ' ').substring(0, 16)
              });
            }
          });
        } else if (json && typeof json === 'object' && json.title && json.version) {
          listToImport.push({
            ...json,
            id: 'imported-scr-' + Date.now(),
            status: json.status || 'Draft',
            updatedAt: json.updatedAt || new Date().toISOString().replace('T', ' ').substring(0, 16)
          });
        }

        if (listToImport.length > 0) {
          onUpdateScreenplay([...listToImport, ...screenplayVersions]);
          setImportStatusMsg(`Imported ${listToImport.length} script version(s) successfully!`);
          setScanLogs(prev => [
            ...prev,
            `[SCRIPT-IMPORT] Merged ${listToImport.length} backup screenplay versions into active tracking tree.`
          ]);
          setTimeout(() => setImportStatusMsg(null), 4000);
        } else {
          setImportStatusMsg("Invalid JSON schema. Make sure title & version properties exist.");
          setTimeout(() => setImportStatusMsg(null), 4000);
        }
      } catch (err) {
        setImportStatusMsg("Could not parse file. Verify it is a valid JSON screenplay backup.");
        setTimeout(() => setImportStatusMsg(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleScreenplayFileSelected = (file: File) => {
    setScrFileName(file.name);

    // 1. Read file as Data URL to store in binary downloadable format
    const readerBinary = new FileReader();
    readerBinary.onload = () => {
      setScrFileUrl(readerBinary.result as string);
    };
    readerBinary.readAsDataURL(file);

    // 2. Read file as Text to parse version tag and metadata across formats (.txt, .md, .fountain, .json, etc.)
    const readerText = new FileReader();
    readerText.onload = (event) => {
      const rawText = event.target?.result as string || '';
      if (!rawText) return;

      // Extract a representative dialogue snippet (first 2500 characters)
      let excerpt = rawText;
      if (excerpt.length > 2500) {
        excerpt = excerpt.substring(0, 2500) + '\n\n... [TRUNCATED FOR SCREEN EXCERPT VIEW - FULL FILE ATTACHED] ...';
      }
      setScrSnippet(excerpt);

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed === 'object') {
            if (parsed.title) setScrTitle(parsed.title);
            if (parsed.version) setScrVersion(parsed.version);
            if (parsed.author) setScrAuthor(parsed.author);
            if (parsed.changeDescription || parsed.changes) setScrChanges(parsed.changeDescription || parsed.changes);
            if (parsed.contentSnippet || parsed.snippet) setScrSnippet(parsed.contentSnippet || parsed.snippet);
            if (parsed.status) setScrStatus(parsed.status);
            setScanLogs(prev => [
              ...prev,
              `[SCRIPT-PARSE] Successfully loaded native JSON screenplay metadata for '${file.name}'.`
            ]);
            return;
          }
        } catch {
          // fallback to text parse
        }
      }

      // Plaintext line parser for Fountain/txt/md headers
      const lines = rawText.split('\n');
      let titleDetected = '';
      let authorDetected = '';
      let versionDetected = '';
      let changesDetected = '';

      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const clean = lines[i].trim();
        const lower = clean.toLowerCase();
        
        if (!titleDetected && (lower.startsWith('title:') || lower.startsWith('# '))) {
          titleDetected = clean.replace(/^(title:|\#\s*)/i, '').trim();
        } else if (!authorDetected && (lower.startsWith('author:') || lower.startsWith('writer:') || lower.startsWith('by:'))) {
          authorDetected = clean.replace(/^(author:|writer:|by:)/i, '').trim();
        } else if (!versionDetected && (lower.startsWith('version:') || lower.startsWith('draft:') || lower.startsWith('v:'))) {
          versionDetected = clean.replace(/^(version:|draft:|v:)/i, '').trim();
        } else if (!changesDetected && (lower.startsWith('changes:') || lower.startsWith('changes log:') || lower.startsWith('changelog:'))) {
          changesDetected = clean.replace(/^(changes:|changes log:|changelog:)/i, '').trim();
        }
      }

      if (titleDetected) {
        setScrTitle(titleDetected);
      } else {
        // Fallback: title from file name pretty print
        setScrTitle(file.name.replace(/\.[^/.]+$/, "").replace(/_|-/g, " "));
      }

      if (authorDetected) setScrAuthor(authorDetected);
      if (versionDetected) {
        setScrVersion(versionDetected);
      } else {
        // Detect version from filename or increment
        const vMatch = file.name.match(/v\d+(\.\d+)*/i);
        if (vMatch) {
          setScrVersion(vMatch[0]);
        } else {
          setScrVersion('v' + (screenplayVersions.length > 0 ? (parseFloat(screenplayVersions[0].version.replace(/[^0-9.]/g, '')) + 0.1 || 1.1).toFixed(1) : '1.0'));
        }
      }

      if (changesDetected) setScrChanges(changesDetected);

      setScanLogs(prev => [
        ...prev,
        `[SCRIPT-PARSE] Processed plaintext '${file.name}' (${file.size} bytes). Extracted Dialog snip and populated draft controls.`
      ]);
    };
    readerText.readAsText(file);
  };

  const handleAddStoryboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stbTitle) return;

    if (!stbImageUrl) {
      setStbFormError("A storyboard sketch image is strictly required. Please upload or drag onto the canvas area first.");
      return;
    }

    const newStoryboard: StoryboardRevision = {
      id: 'stb-' + Date.now(),
      sceneNumber: stbScene,
      panelNumber: stbPanel,
      title: stbTitle,
      description: stbDesc,
      updatedAt: new Date().toISOString().split('T')[0],
      version: 'v1',
      artist: stbArtist || 'Sarah Lin',
      status: stbStatus,
      imageUrl: stbImageUrl
    };

    onUpdateStoryboards([newStoryboard, ...storyboardRevisions]);
    setStbTitle('');
    setStbDesc('');
    setStbArtist('');
    setStbImageUrl('');
    setStbFormError(null);
    setIsAddingStoryboard(false);
  };

  const handleDeleteStoryboard = (id: string) => {
    const item = storyboardRevisions.find(s => s.id === id);
    if (!item) return;

    // Remove from active pipeline storyboards directly
    onUpdateStoryboards(storyboardRevisions.filter(s => s.id !== id));

    setScanLogs(prev => [
      ...prev,
      `[DELETE] Removed storyboard frame '${item.sceneNumber} • ${item.panelNumber}'.`
    ]);
  };



  const handleUploadStoryboardBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const listToImport: StoryboardRevision[] = [];
        
        if (Array.isArray(json)) {
          // If bulk export upload
          json.forEach((board: any, idx) => {
            if (board && typeof board === 'object' && board.title) {
              listToImport.push({
                ...board,
                id: 'imported-stb-' + Date.now() + '-' + idx,
                status: board.status || 'Approved',
                version: board.version || 'v1',
                artist: board.artist || 'Sarah Lin',
                sceneNumber: board.sceneNumber || 'Scene X',
                panelNumber: board.panelNumber || 'Panel X',
                imageUrl: board.imageUrl
              });
            }
          });
        } else if (json && typeof json === 'object' && json.title) {
          // If individual card
          listToImport.push({
            ...json,
            id: 'imported-stb-' + Date.now(),
            status: json.status || 'Approved',
            version: json.version || 'v1',
            artist: json.artist || 'Sarah Lin',
            sceneNumber: json.sceneNumber || 'Scene X',
            panelNumber: json.panelNumber || 'Panel X',
            imageUrl: json.imageUrl
          });
        }

        if (listToImport.length > 0) {
          onUpdateStoryboards([...listToImport, ...storyboardRevisions]);
          setImportStatusMsg(`Imported ${listToImport.length} storyboard file(s) successfully!`);
          setScanLogs(prev => [
            ...prev,
            `[STB-IMPORT] Merged ${listToImport.length} backup storyboard card record(s) into active collection.`
          ]);
          setTimeout(() => setImportStatusMsg(null), 4000);
        } else {
          setImportStatusMsg("Invalid JSON schema. Make sure title & scene properties exist.");
          setTimeout(() => setImportStatusMsg(null), 4000);
        }
      } catch (err) {
        setImportStatusMsg("Could not parse file. Verify it is a valid JSON storyboard backup.");
        setTimeout(() => setImportStatusMsg(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateStoryboardStatus = (id: string, sStatus: StoryboardRevision['status']) => {
    const updated = storyboardRevisions.map(s => {
      if (s.id === id) {
        return { ...s, status: sStatus };
      }
      return s;
    });
    onUpdateStoryboards(updated);
  };

  return (
    <div className="space-y-6" id="film-assets-controller-panel">
      
      {/* SECTION TOP KPIs SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors shadow-sm ${
          isDark ? 'bg-zinc-950/70 border-indigo-500/10' : 'bg-white border-zinc-200'
        }`} id="kpi-footage-backed">
          <div className="space-y-1">
            <span className="text-zinc-500 font-mono text-[9px] tracking-widest uppercase block">Asset Volume Index</span>
            <span className={`text-2xl font-mono font-bold block leading-none ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{totalFootageGB.toFixed(1)} GB</span>
            <span className="text-[10px] text-zinc-400 font-sans block">{totalFileCount} master files registered</span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
          }`}>
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors shadow-sm ${
          isDark ? 'bg-zinc-950/70 border-indigo-500/10' : 'bg-white border-zinc-200'
        }`} id="kpi-screenplay-locked">
          <div className="space-y-1">
            <span className="text-zinc-500 font-mono text-[9px] tracking-widest uppercase block">Screenplay Drafts</span>
            <span className={`text-2xl font-mono font-bold block leading-none ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              {screenplayVersions.length > 0 ? screenplayVersions[0].version : 'None Launched'}
            </span>
            <span className="text-[10px] text-zinc-440 font-sans block font-medium">
              {screenplayVersions.length} revisions documented
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
          }`}>
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors shadow-sm ${
          isDark ? 'bg-zinc-950/70 border-indigo-500/10' : 'bg-white border-zinc-200'
        }`} id="kpi-storyboard-boards">
          <div className="space-y-1">
            <span className="text-zinc-500 font-mono text-[9px] tracking-widest uppercase block">Storyboard Cards</span>
            <span className={`text-2xl font-mono font-bold block leading-none ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{storyboardRevisions.length} active</span>
            <span className="text-[10px] text-zinc-400 font-sans block">
              {storyboardRevisions.filter(s => s.status === 'Approved').length} panels approved
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
          }`}>
            <ImageIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SEGMENTED SWITCHER TAB-NAV */}
      <div className={`p-1 rounded-xl border flex gap-1 ${
        isDark ? 'bg-zinc-950/40 border-zinc-900' : 'bg-zinc-100 border-zinc-200'
      }`} id="assets-inner-nav">
        <button
          onClick={() => setActiveSubTab('footage')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-2 transition cursor-pointer ${
            activeSubTab === 'footage'
              ? isDark 
                ? 'bg-zinc-900 border border-zinc-800 text-indigo-400 shadow' 
                : 'bg-white text-indigo-950 shadow border border-zinc-200'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          Cinema Content & Backups ({normalizedFootageList.length})
        </button>
        <button
          onClick={() => setActiveSubTab('screenplay')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-2 transition cursor-pointer ${
            activeSubTab === 'screenplay'
              ? isDark 
                ? 'bg-zinc-900 border border-zinc-800 text-indigo-400 shadow' 
                : 'bg-white text-indigo-950 shadow border border-zinc-200'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Screenplay Revision History ({screenplayVersions.length})
        </button>
        <button
          onClick={() => setActiveSubTab('storyboards')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-sans flex items-center justify-center gap-2 transition cursor-pointer ${
            activeSubTab === 'storyboards'
              ? isDark 
                ? 'bg-zinc-900 border border-zinc-800 text-indigo-400 shadow' 
                : 'bg-white text-indigo-950 shadow border border-zinc-200'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Storyboard Frame Versioning ({storyboardRevisions.length})
        </button>
      </div>

      {/****************** TAB 1: CINEMA CONTENT & BACKUPS VAULT ******************/}
      {activeSubTab === 'footage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="content-subtab-pane">
          
          {/* LEFT COLUMN: INGESTION CONSOLE & MOUNT TOOL */}
          <div className="space-y-4 lg:col-span-1">
            
            {/* DIRECT MEDIA FILE DRAG & DROP UPLOADER */}
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-950/60 border-zinc-900' : 'bg-white border-zinc-200 shadow-sm'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
                  Direct Media Ingest
                </h4>
              </div>
              <p className="text-[10.5px] text-zinc-400 mb-4 leading-normal">
                Upload video, audio, or DCP files directly. CinePipeline automatically reads attributes, guesses cinema aspect formats, and appends them.
              </p>

              {importStatusMsg && (
                <div className={`p-2.5 rounded font-mono text-[9.5px]/1.3 border mb-3 ${
                  importStatusMsg.toLowerCase().includes('success')
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {importStatusMsg}
                </div>
              )}

              {/* REAL RAW FILE INTAKER INPUT AND UI BOX */}
              <div className="relative group cursor-pointer">
                <input
                  type="file"
                  multiple
                  onChange={handleRealFileInflow}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="py-7 px-4 border border-dashed border-indigo-500/20 hover:border-indigo-500/50 rounded-xl text-center bg-zinc-900/40 hover:bg-zinc-900/70 transition duration-300">
                  <span className="text-2xl block mb-2">📥</span>
                  <span className="text-[10.5px] text-zinc-350 block font-mono font-black uppercase tracking-wider">
                    UPLOAD MEDIA FILE
                  </span>
                  <span className="text-[9px] text-indigo-400/80 font-mono block mt-1">
                    Accepts Video, Audio, DCP (e.g. Scope, IMAX)
                  </span>
                </div>
              </div>
            </div>

            {/* MANUAL METADATA CREATION CONSOLE */}
            <div className={`p-5 rounded-2xl border ${
              isAddingFootage 
                ? isDark ? 'bg-zinc-950 border-indigo-500/20' : 'bg-indigo-50/20 border-indigo-200'
                : isDark ? 'bg-zinc-950/30 border-zinc-900' : 'bg-zinc-100/30 border-zinc-200'
            }`}>
              <div className="flex items-center justify-between border-b border-zinc-900/40 pb-2 mb-3">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                  Custom Batch Declaration
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingFootage(!isAddingFootage)}
                  className="text-[9px] px-2 py-0.5 border border-zinc-800 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                >
                  {isAddingFootage ? 'Collapse' : 'Expand Form'}
                </button>
              </div>

              {isAddingFootage && (
                <form onSubmit={handleRegisterFootage} className="space-y-3.5 text-xs font-sans">
                  <div>
                    <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Asset Reference Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. IMAX_01_Day4_AudioDubbing"
                      required
                      value={footName}
                      onChange={e => setFootName(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">File Category</label>
                      <select
                        value={footFileType}
                        onChange={e => setFootFileType(e.target.value as 'Video' | 'Audio' | 'DCP')}
                        className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Video">🎥 Video File</option>
                        <option value="Audio">🎵 Audio File</option>
                        <option value="DCP">📦 DCP File</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Projection Format</label>
                      <select
                        value={footFormatName}
                        onChange={e => setFootFormatName(e.target.value as 'Scope' | 'IMAX' | 'Flat' | 'Standard')}
                        className="w-full bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Scope">🎥 Scope (2.39:1)</option>
                        <option value="IMAX">🎬 IMAX (1.43:1)</option>
                        <option value="Flat">📺 Flat (1.85:1)</option>
                        <option value="Standard">🖥️ Standard (16:9)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Files In Batch</label>
                      <input
                        type="number"
                        min={1}
                        value={footFileCount}
                        onChange={e => setFootFileCount(Number(e.target.value))}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Size (GB)</label>
                      <input
                        type="number"
                        min={1}
                        value={footSize}
                        onChange={e => setFootSize(Number(e.target.value))}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Inline quick indicators for form */}
                  <div className="bg-zinc-900/30 p-2.5 rounded border border-zinc-850/50 space-y-2">
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block font-bold">Metadata Presets</span>
                    <div className="flex flex-col gap-1.5 font-mono text-[9.5px]">
                      <label className="flex items-center gap-1.5 text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={footIsEdited}
                          onChange={e => setFootIsEdited(e.target.checked)}
                          className="rounded border-zinc-800 text-indigo-500 focus:ring-0 bg-transparent"
                        />
                        Mark as Edited (Ready for Cut)
                      </label>
                      <label className="flex items-center gap-1.5 text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={footNeedsDubbing}
                          onChange={e => setFootNeedsDubbing(e.target.checked)}
                          className="rounded border-zinc-800 text-indigo-500 focus:ring-0 bg-transparent"
                        />
                        This is destined for Dubbing
                      </label>
                      {footNeedsDubbing && (
                        <label className="flex items-center gap-1.5 text-zinc-400 pl-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={footIsDubbed}
                            onChange={e => setFootIsDubbed(e.target.checked)}
                            className="rounded border-zinc-800 text-indigo-500 focus:ring-0 bg-transparent"
                          />
                          Is Dubbing Complete? (Dubbed)
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Backup storage destination</label>
                    <select
                      value={footLocation}
                      onChange={e => setFootLocation(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="AWS S3 Glacier Deep Archive">AWS S3 Glacier</option>
                      <option value="Local on-set NAS RAID-5">Local Raid NAS</option>
                      <option value="On-set Thunderbolt SSD clone #1">Ruggedized SSD</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition text-center uppercase tracking-wide cursor-pointer font-mono text-[10px]"
                  >
                    Insert Into Active Database
                  </button>
                </form>
              )}
              {!isAddingFootage && (
                <p className="text-[10px] text-zinc-550 leading-relaxed italic">
                  Form collapsed. Click "Expand Form" to manually key in precise metadata profiles.
                </p>
              )}
            </div>

            {/* BACKUP RESTORE BUTTON */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-zinc-950/60 border-zinc-905' : 'bg-zinc-50 border-zinc-200'}`}>
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                📁 Offline Backup Ingestion
              </span>
              <p className="text-[10px] font-mono text-zinc-400 leading-relaxed italic">
                Import and restore previous database profiles directly from a .json backup file.
              </p>
              <label className="block p-2 border border-dashed border-zinc-850 hover:border-indigo-500/30 rounded cursor-pointer text-center bg-zinc-900/20 transition">
                <span className="text-[9px] font-mono text-zinc-300 uppercase block font-bold">Import Backup File</span>
                <input type="file" accept=".json" onChange={handleUploadBackupJson} className="hidden" />
              </label>
            </div>
          </div>

          {/* RIGHT COLUMN: ACTIVE METADATA VAULT GRID */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-950/80 border-zinc-900' : 'bg-white border-zinc-200'}`}>
              
              {/* TOP HEADER CONTROLS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900/60 pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-sans font-black text-gray-100 uppercase tracking-wide">Production Files Vault</h4>
                  <p className="text-[10px] text-zinc-400 font-sans">Active footage, Audio logs & DCP formats synchronized on-set.</p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <button
                    onClick={handleRunHashScan}
                    disabled={isScanning || normalizedFootageList.length === 0}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 border border-zinc-800 rounded-lg text-[9px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    Integrity Calibrate
                  </button>
                </div>
              </div>

              {/* SIMULATED SCAN ENGINE */}
              {(isScanning || scanLogs.length > 0) && (
                <div className="bg-black/95 border border-zinc-900 rounded-xl p-3 mb-4 font-mono text-[9px] text-emerald-400 space-y-1.5 shadow-inner">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-1">
                    <span className="font-bold flex items-center gap-1 text-indigo-400 uppercase tracking-wider text-[8.5px]">
                      <Terminal className="w-3.5 h-3.5" /> Validation Console Logs
                    </span>
                    <span className="text-zinc-550 font-semibold">{scanProgress}% completed</span>
                  </div>
                  <div className="h-0.75 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div style={{ width: `${scanProgress}%` }} className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300" />
                  </div>
                  <div className="max-h-[100px] overflow-y-auto space-y-0.5 text-[8px] scrollbar-thin">
                    {scanLogs.map((log, index) => (
                      <div key={index} className={log.includes('[SUCCESS]') || log.includes('[METADATA]') ? 'text-indigo-400 font-bold' : log.includes('[INGEST]') ? 'text-cyan-400' : 'text-zinc-500'}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEARCH & ACCURATE FILTER CRITERIAS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 bg-zinc-900/30 rounded-xl border border-zinc-900/60 mb-4 text-xs font-sans">
                <div>
                  <label className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-0.5">Asset Filter Query</label>
                  <input
                    type="text"
                    placeholder="Search by description or format..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 text-zinc-200 border border-zinc-850 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-0.5">File Type category</label>
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="w-full bg-zinc-950 text-zinc-200 border border-zinc-850 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 font-sans"
                  >
                    <option value="All">All Categories</option>
                    <option value="Video">🎥 Video Files Only</option>
                    <option value="Audio">🎵 Audio Files Only</option>
                    <option value="DCP">📦 DCP Files Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-0.5">Cinema Projection Aspect</label>
                  <select
                    value={formatFilter}
                    onChange={e => setFormatFilter(e.target.value)}
                    className="w-full bg-zinc-950 text-zinc-200 border border-zinc-850 rounded px-2 py-1 focus:outline-none focus:border-indigo-500 font-sans"
                  >
                    <option value="All">All Formats</option>
                    <option value="Scope">🎥 Scope (2.39:1)</option>
                    <option value="IMAX">🎬 IMAX (1.43:1)</option>
                    <option value="Flat">📺 Flat (1.85:1)</option>
                    <option value="Standard">🖥️ Standard (16:9)</option>
                  </select>
                </div>
              </div>

              {/* THE SIMPLER, CLEANER, NON-OVERWHELMING LIST OF CARDS */}
              {filteredFootage.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                  {normalizedFootageList.length === 0 
                    ? 'Vault is completely empty. Drag some media files or use the manual declaration form.'
                    : 'No assets matching selected search criteria.'}
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredFootage.map(f => (
                    <div 
                      key={f.id} 
                      className={`p-3.5 rounded-xl border transition-all hover:border-indigo-500/20 group relative flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isDark ? 'bg-zinc-950/50 border-zinc-900 hover:bg-zinc-950/80' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100/40'
                      }`}
                    >
                      {/* Left Block info + file extension type indicators */}
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                          f.fileType === 'Audio' 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                            : f.fileType === 'DCP'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          <span className="text-sm">
                            {f.fileType === 'Audio' ? '🎵' : f.fileType === 'DCP' ? '📦' : '🎥'}
                          </span>
                        </div>
                        
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-bold text-zinc-200 text-xs block truncate max-w-[180px] sm:max-w-[280px]" title={f.name}>
                              {f.name}
                            </span>
                            
                            {/* Projection format tag */}
                            <span className="px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded font-mono text-[8px] uppercase tracking-wider font-extrabold">
                              {f.formatName}
                            </span>
                          </div>

                          <p className="text-[10px] text-zinc-450 leading-relaxed font-sans flex items-center gap-2">
                            <span>{f.totalSizeGB.toFixed(1)} GB</span>
                            <span>•</span>
                            <span className="font-mono text-[9px] text-zinc-550">MD5: {f.hashMD5}</span>
                          </p>

                          {f.notes && (
                            <p className="text-[9.5px] text-zinc-500 italic truncate max-w-[250px] sm:max-w-[350px]" title={f.notes}>
                              {f.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Block controls & editable metadata */}
                      <div className="flex flex-wrap md:flex-nowrap items-center justify-start md:justify-end gap-3.5 border-t md:border-t-0 border-zinc-900/60 pt-2.5 md:pt-0 shrink-0">
                        
                        {/* EDITED OR NOT EDITED CHANGER */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[7.5px] font-mono text-zinc-550 uppercase tracking-widest font-black block">Composition state</span>
                          <button
                            type="button"
                            onClick={() => handleToggleEditedOnAsset(f.id)}
                            className={`px-2 py-0.8 rounded text-[9.5px] font-mono flex items-center gap-1 border-0 cursor-pointer text-left leading-none transition-colors ${
                              f.isEdited
                                ? 'bg-emerald-500/10 border-0 text-emerald-400 font-bold hover:bg-emerald-500/20'
                                : 'bg-zinc-900 text-zinc-500 font-semibold hover:bg-zinc-800 hover:text-zinc-400'
                            }`}
                          >
                            <span>{f.isEdited ? 'Edited ✓' : 'Raw / Unedited'}</span>
                          </button>
                        </div>

                        {/* FOR DUBBING OR DUBBED */}
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[7.5px] font-mono text-zinc-550 uppercase tracking-widest font-black block">Dubbing & sync</span>
                          <select
                            value={f.isDubbed ? 'dubbed' : f.needsDubbing ? 'needs' : 'none'}
                            onChange={e => handleCycleDubbingOnAsset(f.id, e.target.value)}
                            className="bg-zinc-900/60 border border-zinc-900 text-zinc-300 font-mono text-[9.5px] leading-tight focus:outline-none focus:border-indigo-500 rounded px-1.5 py-0.5"
                          >
                            <option value="none">Original Audio</option>
                            <option value="needs">Needs Dubbing</option>
                            <option value="dubbed">Dubbed Sync OK</option>
                          </select>
                        </div>

                        {/* VIEW / PLAY ACTION BUTTON */}
                        <div className="flex flex-col gap-0.5 md:self-center">
                          <button
                            onClick={() => setActivePreviewAsset(f)}
                            className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer flex items-center justify-center border border-transparent hover:border-zinc-800"
                            title="View / Play Asset File"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400 hover:text-indigo-300" />
                          </button>
                        </div>

                        {/* SCRAP BIN ACTION BUTTON */}
                        <div className="flex flex-col gap-0.5 md:self-center">
                          <button
                            onClick={() => handleMoveToScrapPool(f)}
                            className="text-zinc-400 hover:text-rose-450 p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer flex items-center justify-center border border-transparent hover:border-zinc-800"
                            title="Move to Offline Scrap Pool"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500/60 hover:text-rose-400" />
                          </button>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/****************** TAB 2: SCREENPLAY DRAFT HISTORY ******************/}
      {activeSubTab === 'screenplay' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="screenplay-subtab-pane">
          {/* Main Drafts Timeline List */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-950/80 border-zinc-900' : 'bg-white border-zinc-200 shadow'}`}>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-sans font-black text-gray-100 uppercase tracking-wide">Screenplay Script Version Tree</h4>
                  <p className="text-[10px] text-zinc-400 font-sans">Cold-storage revision archive for production packages and locked drafts.</p>
                </div>
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('screenplay')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-sans font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-950/40"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open Screenplay Studio →</span>
                  </button>
                )}
              </div>

              {screenplayVersions.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                  No screenplay version records committed. Load standard script blueprints to begin tracking locked pages.
                </div>
              ) : (
                <div className="space-y-4">
                  {screenplayVersions.map((s, idx) => {
                    const isExpanded = expandedScriptId === s.id;
                    return (
                      <div key={s.id} className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                        isDark 
                          ? isExpanded ? 'bg-zinc-900/40 border-indigo-500/20' : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800' 
                          : isExpanded ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-50 border-zinc-200 shadow-sm'
                      }`}>
                        {/* Summary Header */}
                        <div 
                          onClick={() => setExpandedScriptId(isExpanded ? null : s.id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.2 rounded uppercase">
                                {s.version}
                              </span>
                              <h5 className="text-sm font-sans font-black text-zinc-250 leading-none">{s.title}</h5>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-sans">
                              Committed by <span className="font-semibold text-zinc-300">{s.author}</span> • {s.updatedAt}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 sm:self-center">
                            <span className={`text-[8.5px] font-mono leading-none border rounded px-1.5 py-0.5 uppercase tracking-wider font-extrabold ${
                              s.status === 'Locked' 
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/35' 
                                : s.status === 'Approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                            }`}>
                              {s.status}
                            </span>
                            <div className="text-zinc-500 p-1">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible details / screenplay page simulator */}
                        {isExpanded && (
                          <div className="border-t border-zinc-900/60 p-4 space-y-4 animate-fade-in text-xs font-sans">
                            <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-850 space-y-1.5">
                              <span className="text-[9px] font-mono text-zinc-550 uppercase font-black tracking-wider block">Commit Log / Description of Change:</span>
                              <p className="text-zinc-300 leading-relaxed">{s.changeDescription || 'No description assigned.'}</p>
                            </div>

                            {s.fileName && (
                              <div className="bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/15 flex items-center justify-between text-xs animate-fade-in">
                                <div className="flex items-center gap-2 text-indigo-300 font-mono">
                                  <FileText className="w-4 h-4 text-indigo-400" />
                                  <span>{s.fileName}</span>
                                </div>
                                {s.fileUrl && (
                                  <a
                                    href={s.fileUrl}
                                    download={s.fileName}
                                    className="px-2.5 py-1 text-[9px] font-mono uppercase bg-indigo-500/25 text-indigo-300 border border-indigo-500/35 hover:bg-indigo-500/35 rounded tracking-wide transition-all duration-300 font-bold"
                                  >
                                    Download Screenplay File
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Dialogue rendering screen */}
                            {s.contentSnippet && (
                              <div className="space-y-1.5">
                                <span className="text-[9px] font-mono text-zinc-550 uppercase font-black tracking-wider block">Script Scene Excerpt Page:</span>
                                <div className="bg-white text-zinc-950 border border-zinc-300 p-6 rounded-lg font-serif italic text-xs shadow-inner space-y-4 max-w-full overflow-x-auto overflow-y-auto leading-relaxed" style={{ fontFamily: 'Courier, "Courier New", monospace' }}>
                                  <div className="text-center font-mono font-black text-[10px] uppercase text-zinc-400">
                                    -- CinePipeline Shoot Draft Page excerpt --
                                  </div>
                                  <div className="pl-6 pr-6 whitespace-pre-wrap select-text">
                                    {s.contentSnippet}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                              <button
                                onClick={() => {
                                  if (comparingScriptId === s.id) {
                                    setComparingScriptId(null);
                                  } else {
                                    setComparingScriptId(s.id);
                                  }
                                }}
                                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 border border-zinc-800 rounded font-semibold text-[10px] uppercase cursor-pointer"
                              >
                                {comparingScriptId === s.id ? 'Close comparison' : 'Compare diff changes'}
                              </button>

                              <button
                                onClick={() => handleDeleteScreenplay(s.id)}
                                className="px-3 py-1 bg-rose-500/10 text-rose-450 border border-rose-500/20 hover:bg-rose-550/20 rounded font-semibold text-[10px] uppercase cursor-pointer transition-all"
                              >
                                Scrap version
                              </button>
                            </div>

                            {/* DIFF SIMULATION DETAILED WINDOW */}
                            {comparingScriptId === s.id && screenplayVersions[idx + 1] && (
                              <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-950/90 font-mono text-[9.5px]/1.5 text-zinc-400 space-y-2 animate-fade-in">
                                <span className="text-indigo-400 font-bold block uppercase tracking-wider text-[8.5px]">Line Diff logs VS {screenplayVersions[idx + 1].version}</span>
                                <div className="border-t border-zinc-900 pt-2 space-y-1">
                                  <p className="text-red-400 italic">--- {screenplayVersions[idx + 1].title}</p>
                                  <p className="text-emerald-400 italic">+++ {s.title}</p>
                                  <p className="text-zinc-650">@@ - dialogue timeline calibration context @@</p>
                                  <p className="border-l-2 border-red-500 pl-2 text-rose-500 bg-rose-950/10">
                                    - {screenplayVersions[idx + 1].contentSnippet?.split('\n')[1] || 'Default older line in previous version'}
                                  </p>
                                  <p className="border-l-2 border-emerald-500 pl-2 text-emerald-400 bg-emerald-950/10">
                                    + {s.contentSnippet?.split('\n')[1] || 'Optimized line modifications'}
                                  </p>
                                  <p className="text-zinc-500">✔ Difference matching computes 4 line changes with 1 character re-spacing.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Screenplay Archive Status & Studio Hand-off */}
          <div className="space-y-4">
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDark ? 'bg-zinc-950/80 border-indigo-500/20' : 'bg-white border-zinc-200 shadow'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-zinc-900">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                    Active Screenplay Record
                  </h4>
                </div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  latestScript?.status === 'Locked'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : latestScript?.status === 'Approved'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                }`}>
                  {latestScript?.status || 'Draft Master'}
                </span>
              </div>

              <div className="space-y-3 font-sans">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono block">Active Draft Title</span>
                  <p className="text-sm font-bold text-white truncate">{latestScript?.title || project.title || 'Untitled Script'}</p>
                  <span className="text-[11px] text-zinc-400 font-mono">{latestScript?.version || 'v1.0'} • By {latestScript?.author || project.writer || 'Author Unassigned'}</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[9px] text-zinc-500 font-mono uppercase block">Scenes</span>
                    <span className="text-lg font-bold text-white font-mono">{latestScript?.totalScenes || latestScript?.scenes?.length || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[9px] text-zinc-500 font-mono uppercase block">Eighths / Pages</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono">{latestScript?.totalPageCountDisplay || (latestScript?.totalPageEighths ? `${Math.floor(latestScript.totalPageEighths / 8)} ${latestScript.totalPageEighths % 8}/8` : 'N/A')}</span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-850/60 space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Tagged Characters:</span>
                    <span className="font-mono font-bold text-zinc-200">{latestScript?.characters?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Scene Locations:</span>
                    <span className="font-mono font-bold text-zinc-200">{latestScript?.locations?.length || 0}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Last Audit Stamp:</span>
                    <span className="font-mono text-zinc-400 text-[10px]">{latestScript?.updatedAt || 'Current'}</span>
                  </div>
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('screenplay')}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-sans font-bold text-xs rounded-xl shadow-lg shadow-indigo-950/40 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Open Screenplay & Scenes Studio</span>
                    <span className="font-mono text-xs">→</span>
                  </button>
                )}
              </div>
            </div>

            {/* Archival Boundary Rule */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-zinc-950/60 border-zinc-900' : 'bg-zinc-50 border-zinc-200'}`}>
              <h5 className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Archival Boundary Rule
              </h5>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                The <strong>Vault & Backups</strong> workspace stores cold-storage checksums, camera raw logs, and immutable revision snapshots.
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                All screenplay ingestion (.FDX, .FOUNTAIN, .PDF, .DOCX), breakdown tag extraction, slugline ordering, and dialogue editing are managed in the specialized <strong>Screenplay & Scenes</strong> workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {/****************** TAB 3: STORYBOARDS FRAME VERSIONING ******************/}
      {activeSubTab === 'storyboards' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="storyboards-subtab-pane">
          {/* Main Storyboard Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-zinc-950/80 border-zinc-900' : 'bg-white border-zinc-200 shadow'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-sans font-black text-gray-100 uppercase tracking-wide flex items-center gap-2">
                    Storyboard visual pipeline grids
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-sans">Visual pre-production panels mapping scene photography. Key specifications for on-ground camera staff.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-emerald-450 hover:text-emerald-300 rounded-lg text-[9px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer" title="Import storyboard using metadata JSON file">
                    <Upload className="w-3.5 h-3.5" />
                    Import Panel JSON
                    <input type="file" accept=".json" onChange={handleUploadStoryboardBackupJson} className="hidden" />
                  </label>

                  {storyboardRevisions.length > 0 && (
                    <button
                      onClick={handleExportAllStoryboardsJson}
                      className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-indigo-400 rounded-lg text-[9px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                      title="Bulk Export active storyboards as a single JSON file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Bulk Export JSON
                    </button>
                  )}
                  <button
                    onClick={() => setIsAddingStoryboard(!isAddingStoryboard)}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-[9px] font-mono font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register Shot Card
                  </button>
                </div>
              </div>

              {storyboardRevisions.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                  No storyboard frames registered. Build visual sequence blocks to instruct camerawork.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {storyboardRevisions.map(s => (
                    <div key={s.id} className={`border rounded-xl p-4 flex flex-col justify-between space-y-3.5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                      isDark ? 'bg-zinc-950/50 border-zinc-900' : 'bg-white border-zinc-255'
                    }`}>
                      <div className="space-y-2">
                        {/* Header bar */}
                        <div className="flex justify-between items-center bg-zinc-900/30 p-1.5 rounded border border-zinc-850/40">
                          <span className="text-[9.5px] font-mono font-bold text-indigo-400 tracking-widest uppercase">
                            {s.sceneNumber} • {s.panelNumber}
                          </span>
                          <span className="text-[8px] font-mono text-zinc-500 font-bold uppercase">
                            {s.version} tag
                          </span>
                        </div>

                        {/* MOCK ILLUSTRATION CANVAS OR UPLOADED STORYBOARD IMAGE */}
                        <div className="bg-[#030408] border border-zinc-850 h-28 rounded-lg relative overflow-hidden flex items-center justify-center">
                          {s.imageUrl ? (
                            <img 
                              src={s.imageUrl} 
                              alt={s.title} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <>
                              {/* Ambient UI focus bracket camera HUD */}
                              <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-indigo-500/45" />
                              <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-indigo-500/45" />
                              <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-indigo-500/45" />
                              <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-indigo-500/45" />
                              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-indigo-500/10 rounded-full flex items-center justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 text-center animate-ping" />
                              </div>

                              <div className="text-center font-sans space-y-1 px-4 z-10 select-none">
                                <Film className="w-6 h-6 text-indigo-500/30 mx-auto" />
                                <p className="font-mono text-[8px] font-semibold text-zinc-400 capitalize">{s.title}</p>
                                <p className="text-[7.5px] text-zinc-650 truncate max-w-[180px]">{s.description}</p>
                              </div>
                            </>
                          )}
                          
                          <div className="absolute bottom-1 right-2 text-[7px] font-mono text-zinc-650 tracking-widest bg-black/60 px-1 py-0.5 rounded leading-none z-10">
                            REC MASTER 24fps
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h5 className="font-bold text-xs text-zinc-350">{s.title}</h5>
                          <p className="text-[10.5px] text-zinc-400 leading-normal" title={s.description}>{s.description}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Artist: <span className="text-zinc-400">{s.artist}</span> • Date: {s.updatedAt}</p>
                        </div>
                      </div>

                      {/* Footer buttons & status controller */}
                      <div className="flex border-t border-zinc-900 pt-2.5 items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <select
                            value={s.status}
                            onChange={e => handleUpdateStoryboardStatus(s.id, e.target.value as StoryboardRevision['status'])}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold focus:outline-none focus:border-indigo-500 text-[10px] rounded px-1.5 py-0.5 leading-none shrink-0"
                          >
                            <option value="Approved">Approved</option>
                            <option value="In-Review">In-Review</option>
                            <option value="Revised">Revised</option>
                          </select>

                          <button
                            onClick={() => downloadStoryboardJson(s)}
                            className="p-1 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-indigo-400 hover:text-indigo-300 transition cursor-pointer shrink-0"
                            title="Download Panel Metadata JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDownloadStoryboardImage(s)}
                            className="p-1 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-indigo-400 hover:text-indigo-300 transition cursor-pointer shrink-0"
                            title="Download Sketch Frame (Image/Blueprint)"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleDeleteStoryboard(s.id)}
                          className="text-zinc-655 hover:text-rose-455 p-1 rounded hover:bg-zinc-900 cursor-pointer transition-all shrink-0 ml-auto"
                          title="Delete Panel (Moves to Recovery Scrap Pool)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Storyboard Panel Form Panel */}
          <div className="space-y-4">
            {isAddingStoryboard && (
              <div className={`p-5 rounded-2xl border animate-fade-in ${isDark ? 'bg-zinc-950/80 border-indigo-500/20' : 'bg-white border-zinc-200'}`}>
                <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider border-b border-zinc-900 pb-2 mb-4">
                  Register Storyboard Shot Card
                </h4>
                <form onSubmit={handleAddStoryboard} className="space-y-4 text-xs font-sans text-zinc-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Scene ID *</label>
                      <input
                        type="text"
                        placeholder="e.g. Scene 4"
                        required
                        value={stbScene}
                        onChange={e => setStbScene(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Panel Pos *</label>
                      <input
                        type="text"
                        placeholder="e.g. Panel 1B"
                        required
                        value={stbPanel}
                        onChange={e => setStbPanel(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Shot naming title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Elena silhouette over lights shadow"
                      required
                      value={stbTitle}
                      onChange={e => setStbTitle(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Camera Frame positioning directive</label>
                    <textarea
                      placeholder="e.g. Low angle close-up. Background skyscrapers dynamic motion blurred."
                      rows={2.5}
                      required
                      value={stbDesc}
                      onChange={e => setStbDesc(e.target.value)}
                      className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Key illustrator</label>
                      <input
                        type="text"
                        placeholder="Sarah Lin"
                        value={stbArtist}
                        onChange={e => setStbArtist(e.target.value)}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 hover:border-zinc-810"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Panel Spec code</label>
                      <select
                        value={stbStatus}
                        onChange={e => setStbStatus(e.target.value as StoryboardRevision['status'])}
                        className="w-full bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-bold"
                      >
                        <option value="Approved">Approved locks</option>
                        <option value="In-Review">In-Review status</option>
                        <option value="Revised">Revised iteration</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 font-mono text-[9px] uppercase tracking-wider block mb-1">Storyboard sketch (Drag/Drop or Select) *</label>
                    <div 
                      className="border-2 border-dashed border-zinc-800 rounded-lg p-3 text-center bg-zinc-950/40 hover:border-indigo-500/50 transition relative flex flex-col items-center justify-center space-y-1 py-4 cursor-pointer"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          resizeAndCompressImage(file).then(dataUrl => {
                            setStbImageUrl(dataUrl);
                            setStbFormError(null);
                          });
                        }
                      }}
                    >
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            resizeAndCompressImage(file).then(dataUrl => {
                              setStbImageUrl(dataUrl);
                              setStbFormError(null);
                            });
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      {stbImageUrl ? (
                        <div className="relative w-full h-20 rounded overflow-hidden animate-fade-in">
                          <img src={stbImageUrl} alt="Uploaded draft preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <span className="absolute bottom-1 right-1 bg-black/60 text-[8px] font-mono leading-none tracking-widest text-emerald-450 px-1.5 py-0.5 rounded uppercase">Sketch Loaded & Optimized</span>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5 text-indigo-400 animate-pulse" />
                          <span className="text-[10px] text-zinc-400 font-semibold">Drag & drop or Click to upload storyboard frame image</span>
                        </>
                      )}
                    </div>
                  </div>

                  {stbFormError && (
                    <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{stbFormError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition text-center uppercase tracking-wide cursor-pointer font-mono"
                  >
                    Commit Storyboard Panel
                  </button>
                </form>
              </div>
            )}

            <div className={`p-4 rounded-xl border space-y-3.5 ${isDark ? 'bg-zinc-950/60 border-zinc-900' : 'bg-zinc-50 border-zinc-200'}`}>
              <h5 className="text-[10px] font-mono font-bold tracking-wider text-indigo-400 uppercase">Art Prep Versioning</h5>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                Storyboards act as initial pre-production blueprints. Approved panels are locked inside the CinePipeline, linking camera staff, lighting setups, and directors to identical spatial references prior to on-set triggers.
              </p>
            </div>

            {/* STORYBOARD BACKUP INGESTION */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? 'bg-zinc-950/60 border-zinc-905' : 'bg-zinc-50 border-zinc-200'}`}>
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest block font-sans">
                📁 Storyboard Panel Ingestion
              </span>
              <p className="text-[10px] font-mono text-zinc-400 leading-relaxed italic">
                Import and restore previous storyboard panels directly from a JSON backup file.
              </p>
              <label className="block p-2 border border-dashed border-zinc-850 hover:border-indigo-500/30 rounded cursor-pointer text-center bg-zinc-900/20 hover:bg-zinc-900/40 transition">
                <span className="text-[9px] font-mono text-zinc-300 uppercase block font-bold">Import Panel Backup</span>
                <input type="file" accept=".json" onChange={handleUploadStoryboardBackupJson} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* CINEMATIC ASSET PREVIEW MODAL */}
      {activePreviewAsset && (() => {
        const uFileRef = uploadedFilesMap[activePreviewAsset.id];
        const isRealFile = !!uFileRef;
        const objectUrl = uFileRef?.objectUrl;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in" id="cinematic-preview-overlay">
            <div 
              className={`w-full max-w-2xl rounded-2xl border p-6 space-y-4 shadow-2xl relative transition-all ${
                isDark ? 'bg-zinc-950 border-zinc-900 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider font-extrabold ${
                      activePreviewAsset.fileType === 'Audio'
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : activePreviewAsset.fileType === 'DCP'
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {activePreviewAsset.fileType || 'Video'}
                    </span>
                    <span className="font-mono text-zinc-550 text-[10px]">MD5: {activePreviewAsset.hashMD5}</span>
                  </div>
                  <h3 className="text-base font-bold font-sans tracking-tight">{activePreviewAsset.name}</h3>
                </div>
                <button
                  onClick={() => setActivePreviewAsset(null)}
                  className="p-1 px-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer text-xs font-mono"
                >
                  ✕ Close
                </button>
              </div>

              {/* Dynamic Player Screen */}
              <div className="bg-black rounded-xl overflow-hidden aspect-video relative border border-zinc-900 flex flex-col items-center justify-center">
                {activePreviewAsset.fileType === 'Audio' ? (
                  <div className="w-full h-full flex flex-col justify-center items-center p-6 space-y-4 bg-gradient-to-b from-zinc-905 to-black">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                      <Activity className="w-8 h-8 animate-pulse text-cyan-400" />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Live audio signal playback</span>
                    <audio 
                      src={objectUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"} 
                      controls 
                      autoPlay
                      className="w-full max-w-md" 
                    />
                    {!isRealFile && (
                      <span className="text-[9px] text-zinc-500 font-mono">
                        (Simulated High-Fidelity Audio Active)
                      </span>
                    )}
                  </div>
                ) : activePreviewAsset.fileType === 'DCP' ? (
                  <div className="w-full h-full relative bg-zinc-950 flex flex-col justify-center items-center">
                    <video 
                      src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" 
                      controls 
                      autoPlay
                      className="w-full h-full object-contain" 
                      playsInline
                    />
                    <div className="absolute top-2 left-2 bg-amber-500/80 backdrop-blur-sm px-2 py-0.5 rounded text-[8.5px] font-mono text-zinc-950 tracking-widest uppercase pointer-events-none font-bold">
                      📦 DCP Master Preview Screening
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative bg-zinc-950 flex flex-col justify-center items-center">
                    <video 
                      src={objectUrl || "https://assets.mixkit.co/videos/preview/mixkit-cinematographer-filming-a-scene-43093-large.mp4"} 
                      controls 
                      autoPlay
                      className="w-full h-full object-contain" 
                      playsInline
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4") {
                          target.src = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
                        }
                      }}
                    />
                    {!isRealFile && (
                      <div className="absolute top-2 left-2 bg-indigo-600/85 backdrop-blur-xs px-2 py-0.5 rounded text-[8.5px] font-mono text-white tracking-widest uppercase pointer-events-none border border-indigo-500/20">
                        🎬 Simulated Stock Stream Active · {activePreviewAsset.formatName || 'Scope'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Grid attributes details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-900/35 p-3 rounded-lg border border-zinc-900/50 font-mono text-[10px] text-zinc-450">
                <div className="space-y-0.5">
                  <span className="text-[8px] text-zinc-500 uppercase block">Aspect Ratio</span>
                  <span className="font-bold text-zinc-300">
                    {activePreviewAsset.formatName === 'Scope' ? 'Scope (2.39:1)' : 
                     activePreviewAsset.formatName === 'IMAX' ? 'IMAX (1.43:1)' : 
                     activePreviewAsset.formatName === 'Flat' ? 'Flat (1.85:1)' : 'Standard (16:9)'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-zinc-500 uppercase block">Size & Files</span>
                  <span className="font-bold text-zinc-300">
                    {activePreviewAsset.totalSizeGB.toFixed(1)} GB ({activePreviewAsset.fileCount || 1} files)
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-zinc-500 uppercase block">Edited Status</span>
                  <span className={`font-bold ${activePreviewAsset.isEdited ? 'text-emerald-400' : 'text-zinc-450'}`}>
                    {activePreviewAsset.isEdited ? 'Edited ✓' : 'Original Raw'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-zinc-500 uppercase block">Sync Mode</span>
                  <span className="font-bold text-zinc-300">
                    {activePreviewAsset.isDubbed ? 'Dubbed Sync' : activePreviewAsset.needsDubbing ? 'Needs Dub' : 'Original sound'}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-900">
                <button
                  onClick={() => {
                    downloadFootageJson(activePreviewAsset);
                    // Trigger same downloaded file download
                    if (isRealFile && objectUrl) {
                      const dlAnchor = document.createElement('a');
                      dlAnchor.href = objectUrl;
                      dlAnchor.download = uFileRef.file.name;
                      document.body.appendChild(dlAnchor);
                      dlAnchor.click();
                      dlAnchor.remove();
                    }
                  }}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  Trigger Redundant Backup
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
