import React from 'react';
import { ThinkingStep } from '../types'; //
import { CheckCircle, RefreshCw, AlertCircle } from 'lucide-react'; //
// LoadingSpinner importu sizde zaten mevcut
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ThinkingProcessProps {
  steps: ThinkingStep[]; //
  isThinking: boolean; //
  error: string | null; //
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, isThinking, error }) => { //
  if (!isThinking && steps.length === 0 && !error) { //
    return null;
  }

  // getStepIcon fonksiyonu artık doğrudan render içinde kullanılacak
  // ve biraz daha büyük ikonlar döndürecek
  const getStepIcon = (status: ThinkingStep['status']) => { //
    switch (status) {
      case 'pending':
        // Kendi LoadingSpinner'ınızı veya animasyonlu RefreshCw kullanabilirsiniz
        // return <LoadingSpinner size="md" />; 
        return <RefreshCw className="animate-spin h-5 w-5 text-blue-500 flex-shrink-0" />; //
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />; //
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />; //
      default:
        return <div className="h-5 w-5 flex-shrink-0" />; // Boşluk tutucu
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-inner mb-4">
      {/* "Düşünce Süreci" başlığı sizde zaten var */}
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Düşünce Süreci</h3>
      
      {error && ( //
        <div className="text-red-500 dark:text-red-400 mb-2 p-3 bg-red-100 dark:bg-red-900/30 rounded-md">
          <AlertCircle className="inline-block h-5 w-5 mr-2" />
          <strong>Hata:</strong> {error}
        </div>
      )}

      {/* Adımlar için 'ul' yerine 'div' kullanarak daha fazla kontrol sağlıyoruz */}
      <div className="space-y-3">
        {steps.map((step, index) => ( //
          <div 
            key={index} 
            className={`flex items-start p-3 rounded-md transition-all duration-300
              ${step.status === 'pending' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-200 dark:bg-gray-700/50'}
              ${step.status === 'completed' ? 'opacity-70' : 'opacity-100'}
            `}
          >
            {/* İkon Bölümü */}
            <div className="mr-3 mt-1">
              {getStepIcon(step.status)}
            </div>

            {/* Metin Bölümü (Başlık + Açıklama) */}
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {step.name} {/* */}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {step.description} {/* YENİ AÇIKLAMA ALANI */}
              </span>
            </div>
          </div>
        ))}
      </ul>

      {/* Henüz hiç adım yokken gösterilen yüklenici */}
      {isThinking && steps.length === 0 && !error && ( //
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 p-3">
          <LoadingSpinner size="sm" /> {/* */}
          <span className="ml-2">Analiz başlatılıyor...</span>
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess; //