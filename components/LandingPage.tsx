import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, MessagesSquare, FileText, FilePenLine, Zap, PlugZap, Workflow, Sparkles, Mail, Github, Share2 } from 'lucide-react';

interface LandingPageProps {
    onLoginClick: () => void;
    onSignupClick: () => void;
}

const LogoIcon = ({ className, theme = 'light' }: { className?: string; theme?: 'light' | 'dark' }) => {
    const colors = theme === 'light'
        ? { path: '#4f46e5', circle: '#a5b4fc' } // indigo-600, indigo-300
        : { path: '#6366f1', circle: '#818cf8' }; // indigo-500, indigo-400

    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className={className} aria-hidden="true">
          <path fill={colors.path} d="M50 5L0 95h25l25-50 25 50h25L50 5z"/>
          <circle fill={colors.circle} cx="50" cy="58" r="10"/>
        </svg>
    );
};

// --- START: Flow Viewer Example Data ---
const SAMPLE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Talep Geldi">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Analizi Yap">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:exclusiveGateway id="Gateway_1" name="Onay Gerekli mi?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1" />
    <bpmn:task id="Task_2" name="Onay Al">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_3" name="Evet" sourceRef="Gateway_1" targetRef="Task_2" />
    <bpmn:endEvent id="EndEvent_1" name="Süreç Bitti">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:incoming>Flow_5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_4" name="Hayır" sourceRef="Gateway_1" targetRef="EndEvent_1" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_2" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
        <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds x="179" y="159" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="168" y="202" width="59" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Activity_1u4m5ru_di" bpmnElement="Task_1"><dc:Bounds x="270" y="137" width="100" height="80" /></bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Gateway_131l51q_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="425" y="152" width="50" height="50" /><bpmndi:BPMNLabel><dc:Bounds x="408" y="122" width="84" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Activity_013k5rc_di" bpmnElement="Task_2"><dc:Bounds x="530" y="137" width="100" height="80" /></bpmndi:BPMNShape>
        <bpmndi:BPMNShape id="Event_1i8w541_di" bpmnElement="EndEvent_1"><dc:Bounds x="682" y="159" width="36" height="36" /><bpmndi:BPMNLabel><dc:Bounds x="672" y="202" width="56" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>
        <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="215" y="177" /><di:waypoint x="270" y="177" /></bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="370" y="177" /><di:waypoint x="425" y="177" /></bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="475" y="177" /><di:waypoint x="530" y="177" /><bpmndi:BPMNLabel><dc:Bounds x="495" y="159" width="22" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5"><di:waypoint x="630" y="177" /><di:waypoint x="682" y="177" /></bpmndi:BPMNEdge>
        <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="450" y="202" /><di:waypoint x="450" y="250" /><di:waypoint x="700" y="250" /><di:waypoint x="700" y="195" /><bpmndi:BPMNLabel><dc:Bounds x="565" y="223" width="20" height="14" /></bpmndi:BPMNLabel></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
const flowViewerUrl = `/studio?type=bpmn&data=${encodeURIComponent(btoa(unescape(encodeURIComponent(SAMPLE_BPMN_XML))))}`;
// --- END: Flow Viewer Example Data ---

const AuthModal = ({ onClose, onProceed }: { onClose: () => void; onProceed: () => void; }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-70 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-gray-900 text-white p-8 rounded-2xl w-full max-w-md relative border border-gray-700 shadow-2xl">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <div className="flex justify-center mb-6">
                         <LogoIcon className="w-12 h-12" theme="dark" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Devam etmek için giriş yapın</h2>
                    <p className="text-gray-400 mb-8">
                        Asisty.AI'yi kullanmak için mevcut bir hesapla giriş yapmalı veya yeni bir hesap oluşturmalısınız.
                    </p>

                    <div className="space-y-4">
                        <button disabled className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.599-1.506 12.49-4.07l-5.285-4.113c-1.746 1.182-4.055 1.887-6.71 1.887c-5.22 0-9.605-3.375-11.285-7.94l-6.522 5.023C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.285 4.113c3.044-2.822 4.955-7.042 4.955-11.684c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                            <span className="font-semibold">Google ile Devam Et</span>
                        </button>
                        <button disabled className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Github className="w-5 h-5" />
                            <span className="font-semibold">GitHub ile Devam Et</span>
                        </button>
                        <button onClick={onProceed} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                           <Mail className="w-5 h-5" />
                           E-posta ile Devam Et
                        </button>
                    </div>
                     <p className="text-xs text-gray-500 mt-8">
                        Devam ederek <a href="#" className="underline hover:text-white">Hizmet Şartları</a>'nı kabul etmiş ve <a href="#" className="underline hover:text-white">Gizlilik Politikası</a>'nı onaylamış olursunuz.
                    </p>
                </div>
            </div>
        </div>
    );
};


export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
    const [isAnnual, setIsAnnual] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        document.title = "Asisty.AI - İş Analizinizi Yapay Zeka ile Güçlendirin";
    }, []);
    
    const pageStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        html {
            scroll-behavior: smooth;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7faff;
            color: #111827;
        }

        .glow-arc {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 200%;
            height: 1000px;
            z-index: 10;
        }

        .glow-arc::before {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to top, #f7faff 10%, transparent);
            z-index: 12;
        }

        .glow-arc::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 100%;
            max-width: 1600px;
            height: 800px;
            border-top: 2px solid rgba(79, 70, 229, 0.4);
            border-radius: 50%;
            box-shadow: 0 -20px 100px 0px rgba(79, 70, 229, 0.2);
            z-index: 11;
        }

        .feature-icon-list svg {
            width: 1.25rem;
            height: 1.25rem;
            flex-shrink: 0;
            color: #4f46e5;
        }

        .pricing-toggle-bg {
            transition: background-color 0.3s ease;
        }
        .pricing-toggle-dot {
            transition: transform 0.3s ease;
            transform: translateX(0);
        }
        input:checked + .pricing-toggle-bg .pricing-toggle-dot {
            transform: translateX(100%);
        }
    `;

    return (
        <>
            <style>{pageStyles}</style>
            
            <div className="flex flex-col w-full overflow-x-hidden antialiased">
                <div className="relative min-h-screen w-full flex flex-col items-center overflow-hidden" style={{backgroundColor: '#f7faff'}}>
                    <header className="absolute top-0 left-0 right-0 w-full py-4 z-50">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-14">
                            <a href="#" className="flex items-center gap-2" aria-label="Asisty.AI Ana Sayfa">
                                <LogoIcon className="w-8 h-8" theme="light" />
                                <span className="text-2xl font-bold text-gray-900">Asisty.AI</span>
                            </a>
                            <div className="hidden md:flex items-center gap-6">
                                <a href="#features" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Özellikler</a>
                                <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Fiyatlandırma</a>
                                <a href={flowViewerUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
                                    Süreç Tasarımcısı
                                </a>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={onLoginClick} className="text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">Giriş Yap</button>
                                <button onClick={onSignupClick} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                    Ücretsiz Başla
                                </button>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 flex flex-col justify-center items-center w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-10 pb-40 z-20">
                        <div className="mb-5">
                            <span className="inline-flex items-center gap-2 px-4 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-full">
                                <span className="font-bold">Asisty.AI</span> İş Analiz Asistanınız
                            </span>
                        </div>
                        <h1 
                            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter text-gray-900 leading-tight"
                            dangerouslySetInnerHTML={{ __html: 'Yapay zeka ile <span class="text-indigo-600"> analiz </span> gücünüzü serbest bırakın.' }}
                        ></h1>
                        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-gray-600">
                            Yapay zeka ile sohbet ederek kapsamlı iş analizleri, kullanıcı hikayeleri ve test senaryoları oluşturun.
                        </p>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                setIsAuthModalOpen(true);
                            }}
                            className="w-full max-w-3xl mt-10"
                        >
                           <div className="relative w-full p-2 bg-white rounded-2xl shadow-xl border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                <textarea
                                    name="prompt"
                                    rows={3}
                                    className="w-full p-4 pr-16 text-base text-gray-700 border-none resize-none outline-none focus:ring-0 placeholder:text-gray-400"
                                    placeholder="Örn: E-ticaret sitem için ödeme akışı test senaryoları oluştur..."
                                ></textarea>
                                <button
                                    type="submit"
                                    className="absolute right-5 bottom-5 flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl shadow-lg transition-all
                                        hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    aria-label="Analizi Başlat"
                                >
                                    <Sparkles className="w-6 h-6 text-white" />
                                </button>
                            </div>
                        </form>
                    </main>

                    <div className="glow-arc" aria-hidden="true"></div>
                </div>
                
                <section id="features" className="w-full py-20 md:py-32 bg-white z-20">
                     <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                            <span className="text-base font-semibold leading-7 text-indigo-600">Özellikler</span>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                İş Akışınızı Güçlendirecek Her Şey
                            </h2>
                            <p className="mt-6 text-lg text-gray-600">
                                Asisty.AI, fikir aşamasından dokümantasyona kadar tüm iş analizi sürecinizi tek bir platformda birleştirir.
                            </p>
                        </div>
                        
                        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <MessagesSquare className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Sohbet Tabanlı Analiz</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Doğal dilde konuşarak gereksinimleri, kullanıcı hikayelerini ve kabul kriterlerini anında oluşturun.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Canlı Canvas Editör</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Yapay zekanın ürettiği çıktılar, Markdown destekli zengin metin editörünüze anında yansır.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <FilePenLine className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Akıllı Düzenleme Araçları</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Mevcut dokümanlarınızı "Özetle", "Basitleştir" veya "Devam Et" komutlarıyla anında düzenleyin.
                                </p>
                            </div>
                             <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <Workflow className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Otomatik Görselleştirme</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Analizlerinizi ve iş akışlarınızı otomatik olarak Mermaid veya BPMN diyagramlarına dönüştürün.
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <Share2 className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Paylaşılabilir Diyagramlar</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Oluşturulan diyagramları, uygulamaya giriş gerektirmeyen özel linklerle ekibinizle paylaşın. <a href={flowViewerUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline">Örnek Görüntüle &rarr;</a>
                                </p>
                            </div>
                            <div className="flex flex-col">
                                <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-gray-900">Hazır Şablonlar</h3>
                                <p className="mt-2 text-base text-gray-600">
                                    Test senaryoları, proje kapsamı veya gereksinim listeleri gibi kanıtlanmış şablonlar üzerinden ilerleyin.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="pricing" className="w-full py-20 md:py-32 bg-gray-50 z-20">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="max-w-3xl mx-auto text-center">
                            <span className="text-base font-semibold leading-7 text-indigo-600">Fiyatlandırma</span>
                            <h2 className="mt-2 text-4xl font-extrabold tracking-tighter text-gray-900 sm:text-5xl">
                                Size Uygun Planı Seçin
                            </h2>
                            <p className="mt-6 text-lg text-gray-600">
                                Bireysel kullanım için ücretsiz başlayın veya ekibiniz için gelişmiş özellikleri açın.
                            </p>
                        </div>

                        <div className="mt-16 flex justify-center items-center gap-4">
                            <span className={`text-sm font-medium ${isAnnual ? 'text-gray-500' : 'text-indigo-600'}`}>Aylık</span>
                            <label htmlFor="pricing-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="pricing-toggle" className="sr-only peer" checked={isAnnual} onChange={() => setIsAnnual(!isAnnual)} />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 pricing-toggle-bg peer-checked:bg-indigo-600">
                                    <div className="absolute top-0.5 left-[2px] bg-white border border-gray-300 rounded-full h-5 w-5 pricing-toggle-dot"></div>
                                </div>
                            </label>
                            <span className={`text-sm font-medium ${isAnnual ? 'text-indigo-600' : 'text-gray-500'}`}>
                                Yıllık (%20 İndirim)
                            </span>
                        </div>

                        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
                                <h3 className="text-xl font-semibold text-gray-900">Temel</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900">0₺</p>
                                <p className="mt-3 text-base text-gray-600">Bireysel kullanım ve denemeler için.</p>
                                <button onClick={onSignupClick} className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-600 bg-white border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                                    Ücretsiz Başla
                                </button>
                                <ul className="mt-8 space-y-3 text-sm text-gray-600 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />1,000,000 Token (Tek Seferlik)</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />5 Doküman Sınırı</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Temel AI Özellikleri</li>
                                </ul>
                            </div>
                            <div className="bg-indigo-600 p-8 rounded-3xl shadow-2xl relative flex flex-col">
                                <span className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 inline-flex items-center px-4 py-1 text-sm font-medium text-white bg-indigo-800 rounded-full">
                                    Önerilen
                                </span>
                                <h3 className="text-xl font-semibold text-white">Pro</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-white">
                                    {isAnnual ? '160₺' : '200₺'}
                                    <span className="text-sm font-medium text-indigo-100">/kullanıcı/ay</span>
                                </p>
                                <p className="mt-3 text-base text-indigo-100">Profesyoneller ve küçük ekipler için.</p>
                                <button onClick={onSignupClick} className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-700 bg-white rounded-lg hover:bg-gray-100 transition-colors">
                                    Pro'yu Başlat
                                </button>
                                <ul className="mt-8 space-y-3 text-sm text-indigo-50 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />15,000,000 Token/ay</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Sınırsız Doküman</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Gelişmiş AI Özellikleri</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Entegrasyonlar</li>
                                </ul>
                            </div>
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-200 flex flex-col">
                                <h3 className="text-xl font-semibold text-gray-900">Kurumsal</h3>
                                <p className="mt-4 text-4xl font-bold tracking-tight text-gray-900">Özel</p>
                                <p className="mt-3 text-base text-gray-600">Büyük ölçekli ekipler ve özel ihtiyaçlar için.</p>
                                <a href="mailto:destek@asisty.ai" className="mt-8 block w-full text-center px-6 py-3 text-base font-medium text-indigo-600 bg-white border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                                    İletişime Geçin
                                </a>
                                <ul className="mt-8 space-y-3 text-sm text-gray-600 feature-icon-list">
                                    <li className="flex items-center gap-3"><CheckCircle2 />Özelleştirilebilir Token Limiti</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Pro'daki Her Şey</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Özel Güvenlik (SSO)</li>
                                    <li className="flex items-center gap-3"><CheckCircle2 />Öncelikli Destek</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>
                
                <section className="w-full py-20 md:py-32 bg-gray-900 z-20">
                    <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                        <h2 className="text-4xl font-extrabold tracking-tighter text-white">
                            İş analiz süreçlerinizi otomatikleştirmeye hazır mısınız?
                        </h2>
                        <p className="mt-6 text-xl text-indigo-100">
                            Hemen ücretsiz başlayın ve Asisty.AI'nin gücünü keşfedin. Kredi kartı gerekmez.
                        </p>
                        <button 
                            onClick={onSignupClick}
                            className="mt-10 inline-flex items-center px-8 py-4 text-lg font-medium text-indigo-700 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
                        >
                            Analize Başla
                        </button>
                    </div>
                </section>
                
                <footer className="w-full py-16 bg-gray-900 z-20 border-t border-gray-700">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center text-gray-400">
                        <p>&copy; {new Date().getFullYear()} Asisty.AI. Tüm hakları saklıdır.</p>
                    </div>
                </footer>
            </div>
            {isAuthModalOpen && (
                <AuthModal
                    onClose={() => setIsAuthModalOpen(false)}
                    onProceed={onLoginClick}
                />
            )}
        </>
    );
}