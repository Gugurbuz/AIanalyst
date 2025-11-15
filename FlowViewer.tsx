import React, { useMemo } from 'react';
import { BPMNViewer } from './components/BPMNViewer';
// Eğer ayrı bir MermaidViewer yazarsan import et:
// import { MermaidViewer } from './components/MermaidViewer';

function decodeBase64ToString(b64: string): string {
  // URL decode
  const decoded = decodeURIComponent(b64);
  // base64 -> binary
  const binary = atob(decoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // UTF-8 decode
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

export const FlowViewer: React.FC = () => {
  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );

  const type = (searchParams.get('type') || '').toLowerCase();
  const data = searchParams.get('data');

  if (!type || !data) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="max-w-md text-center text-sm text-slate-700">
          <p className="font-semibold mb-2">Geçersiz veya eksik parametre</p>
          <p>
            URL şu formatta olmalıdır:
            <br />
            <code className="text-xs break-all">
              /flowviewer?type=bpmn&amp;data=&lt;base64_encoded_data&gt;
            </code>
          </p>
        </div>
      </div>
    );
  }

  let diagramCode: string;
  try {
    diagramCode = decodeBase64ToString(data);
  } catch (e) {
    console.error('Decode hatası:', e);
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="max-w-md text-center text-sm text-red-700">
          <p className="font-semibold mb-2">Veri çözümlenemedi</p>
          <p className="text-xs break-all">
            data parametresi bozuk veya geçersiz görünüyor.
          </p>
        </div>
      </div>
    );
  }

  if (type === 'bpmn') {
    return (
      <div className="w-screen h-screen">
        <BPMNViewer xml={diagramCode} />
      </div>
    );
  }

  if (type === 'mermaid') {
    // MermaidViewer hazır olduğunda burayı açarsın
    // return (
    //   <div className="w-screen h-screen">
    //     <MermaidViewer code={diagramCode} />
    //   </div>
    // );
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="max-w-md text-center text-sm text-slate-700">
          <p className="font-semibold mb-2">Mermaid görüntüleyici henüz tanımlı değil</p>
          <p className="text-xs break-all">
            type=mermaid için bir MermaidViewer bileşeni eklemen gerekiyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <div className="max-w-md text-center text-sm text-slate-700">
        <p className="font-semibold mb-2">Desteklenmeyen tip</p>
        <p className="text-xs">
          type parametresi sadece <code>bpmn</code> veya <code>mermaid</code> olabilir.
        </p>
      </div>
    </div>
  );
};
