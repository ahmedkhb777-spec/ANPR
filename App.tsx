
import React, { useState, useRef, useMemo } from 'react';
import { analyzeLicensePlate } from './services/geminiService';
import { AppState, ProcessedItem, VehicleType, Language } from './types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const BACKGROUND_IMAGE = "https://r.jina.ai/i/6f9024f227b6408285579979b09a4731";

const translations = {
  ar: {
    title: "نظام كشف اللوحات الذكي",
    subtitle: "تحليل وتصنيف لوحات السيارات بالذكاء الاصطناعي",
    exportExcel: "تصدير Excel",
    exportZip: "تصدير الصور (Zip)",
    clearAll: "مسح الكل",
    uploadTitle: "ارفع صور اللوحات هنا",
    uploadDesc: "يمكنك اختيار صور متعددة. سيقوم البرنامج بتحديد الأرقام، الفئة، والنوع تلقائياً.",
    noImages: "لا توجد صور حالياً، ابدأ برفع بعض اللوحات",
    plateNumber: "رقم اللوحة",
    letter: "الفئة / الحرف",
    city: "الجهة / المدينة",
    country: "تصنيف الدولة",
    vehicleType: "نوع المركبة",
    confidence: "دقة التحليل",
    processing: "جاري التحليل...",
    completed: "تم التحليل",
    pending: "في الانتظار",
    error: "خطأ في المعالجة",
    total: "الإجمالي",
    successCount: "ناجح",
    processingCount: "جاري",
    failedCount: "فاشل",
    note: "ملاحظة: البيانات تعالج سحابياً ولا تُخزن بشكل دائم.",
    confirmClear: "هل أنت متأكد من مسح جميع النتائج؟",
    vehicleTypes: {
      [VehicleType.PRIVATE]: "خصوصي (ملاكي)",
      [VehicleType.TAXI]: "أجرة (تاكسي)",
      [VehicleType.POLICE]: "شرطة / أمن",
      [VehicleType.AMBULANCE]: "إسعاف / طوارئ",
      [VehicleType.OTHER]: "أخرى",
    }
  },
  en: {
    title: "Smart Plate Detector",
    subtitle: "AI-Powered Plate Recognition & Classification",
    exportExcel: "Export Excel",
    exportZip: "Export Images (Zip)",
    clearAll: "Clear All",
    uploadTitle: "Upload Plate Images",
    uploadDesc: "Multiple images supported. Numbers, categories, and types are detected automatically.",
    noImages: "No images yet, start by uploading some plates",
    plateNumber: "Plate Number",
    letter: "Category / Letter",
    city: "Region / City",
    country: "Country Classification",
    vehicleType: "Vehicle Type",
    confidence: "Confidence",
    processing: "Analyzing...",
    completed: "Analyzed",
    pending: "Pending",
    error: "Error",
    total: "Total",
    successCount: "Success",
    processingCount: "Running",
    failedCount: "Failed",
    note: "Note: Data is processed in the cloud and not stored permanently.",
    confirmClear: "Clear all results?",
    vehicleTypes: {
      [VehicleType.PRIVATE]: "Private",
      [VehicleType.TAXI]: "Taxi",
      [VehicleType.POLICE]: "Police",
      [VehicleType.AMBULANCE]: "Ambulance",
      [VehicleType.OTHER]: "Other",
    }
  }
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    items: [],
    isGlobalLoading: false,
    language: 'ar'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useMemo(() => translations[state.language], [state.language]);

  const toggleLanguage = () => {
    setState(prev => ({ ...prev, language: prev.language === 'ar' ? 'en' : 'ar' }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files) as File[];

    fileArray.forEach((file) => {
      const reader = new FileReader();
      const id = Math.random().toString(36).substr(2, 9);
      
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const newItem: ProcessedItem = {
          id,
          fileName: file.name,
          image: base64String,
          status: 'pending',
          result: null,
          error: null,
        };
        
        setState(prev => ({
          ...prev,
          items: [...prev.items, newItem]
        }));

        processItem(id, base64String);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processItem = async (id: string, base64Image: string) => {
    updateItemStatus(id, { status: 'processing' });
    try {
      const result = await analyzeLicensePlate(base64Image);
      updateItemStatus(id, { status: 'completed', result });
    } catch (err) {
      console.error(err);
      updateItemStatus(id, { status: 'error', error: "فشل في تحليل الصورة" });
    }
  };

  const updateItemStatus = (id: string, updates: Partial<ProcessedItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
    }));
  };

  const exportToExcel = () => {
    const completedItems = state.items.filter(i => i.status === 'completed' && i.result);
    if (completedItems.length === 0) return;

    const data = completedItems.map(item => ({
      [t.plateNumber]: item.result?.plateNumber,
      [t.letter]: item.result?.letter,
      [t.city]: item.result?.city,
      [t.vehicleType]: t.vehicleTypes[item.result!.vehicleType],
      [t.country]: item.result?.country,
      [t.confidence]: `${((item.result?.confidence || 0) * 100).toFixed(1)}%`
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "النتائج");
    XLSX.writeFile(wb, `license_plates_${new Date().getTime()}.xlsx`);
  };

  const exportToZip = async () => {
    const completedItems = state.items.filter(i => i.status === 'completed' && i.result);
    if (completedItems.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("license_images");

    completedItems.forEach((item) => {
      const base64Data = item.image.split(',')[1];
      const extension = item.fileName.split('.').pop() || 'jpg';
      const newName = `${item.result?.plateNumber || 'unknown'}_${item.result?.letter || ''}_${item.id}.${extension}`;
      folder?.file(newName, base64Data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `plates_backup_${new Date().getTime()}.zip`;
    link.click();
  };

  const removeItem = (id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const clearAll = () => {
    if (confirm(t.confirmClear)) {
      setState(prev => ({ ...prev, items: [] }));
    }
  };

  return (
    <div 
      className={`min-h-screen w-full relative overflow-hidden flex flex-col font-cairo`}
      dir={state.language === 'ar' ? 'rtl' : 'ltr'}
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.9)), url(${BACKGROUND_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <header className="w-full p-5 bg-slate-900/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">
              <i className="fa-solid fa-camera-retro text-white"></i>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-white">{t.title}</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{t.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLanguage}
              className="bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 transition-all"
            >
              {state.language === 'ar' ? 'English' : 'العربية'}
            </button>
            
            {state.items.length > 0 && (
              <div className="flex gap-2">
                <button onClick={exportToExcel} className="hidden md:flex bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold items-center gap-2 transition-all">
                  <i className="fa-solid fa-file-excel"></i> {t.exportExcel}
                </button>
                <button onClick={clearAll} className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/30">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-700 rounded-3xl p-8 text-center transition-all hover:bg-slate-800/60 group cursor-pointer"
        >
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-images text-3xl text-blue-500"></i>
          </div>
          <h2 className="text-xl font-bold mb-1">{t.uploadTitle}</h2>
          <p className="text-slate-400 max-w-sm mx-auto text-xs">
            {t.uploadDesc}
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            multiple 
            onChange={handleImageUpload} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.items.map((item) => (
            <div key={item.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden flex flex-col group animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="relative aspect-[4/3] bg-black">
                <img src={item.image} alt={item.fileName} className="w-full h-full object-contain" />
                <div className="absolute top-2 right-2 flex gap-2">
                   <button onClick={() => removeItem(item.id)} className="w-7 h-7 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors">
                     <i className="fa-solid fa-xmark text-xs"></i>
                   </button>
                </div>
                {item.status === 'processing' && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{t.processing}</span>
                  </div>
                )}
                {item.status === 'completed' && (
                  <div className={`absolute bottom-2 ${state.language === 'ar' ? 'right-2' : 'left-2'}`}>
                    <div className="bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg uppercase">
                      {t.completed}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col gap-4">
                <div className="flex items-start justify-between border-b border-white/5 pb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{t.plateNumber}</span>
                    <span className="text-xl font-black text-white tracking-widest font-mono">
                      {item.result?.plateNumber || '----'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{t.letter}</span>
                    <span className="text-xl font-black text-yellow-500 font-mono">
                      {item.result?.letter || '--'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-700/30">
                    <span className="text-[9px] text-slate-500 block mb-0.5 font-bold uppercase">{t.city}</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {item.result?.city || 'غير محدد'}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-700/30">
                    <span className="text-[9px] text-slate-500 block mb-0.5 font-bold uppercase">{t.country}</span>
                    <span className={`text-xs font-bold truncate block ${item.result?.country?.includes('الإمارات') ? 'text-blue-400' : 'text-orange-400'}`}>
                      {item.result?.country || 'غير معروف'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <TypeIcon type={item.result?.vehicleType || VehicleType.OTHER} />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">{t.vehicleType}</span>
                        <span className="text-xs font-bold text-white">
                          {item.result ? t.vehicleTypes[item.result.vehicleType] : '---'}
                        </span>
                     </div>
                  </div>
                  {item.result && (
                    <div className="text-right">
                       <span className="text-[9px] text-slate-500 font-bold uppercase block">{t.confidence}</span>
                       <span className={`text-xs font-mono font-bold ${item.result.confidence > 0.8 ? 'text-green-500' : 'text-yellow-500'}`}>
                         {(item.result.confidence * 100).toFixed(0)}%
                       </span>
                    </div>
                  )}
                </div>

                {item.status === 'error' && (
                  <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20 flex items-center gap-2 text-red-400">
                    <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                    <span className="text-[10px] font-bold uppercase">{item.error || t.error}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {state.items.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20">
            <i className="fa-solid fa-magnifying-glass-location text-7xl mb-6"></i>
            <p className="text-lg font-bold">{t.noImages}</p>
          </div>
        )}
      </main>
      
      {state.items.length > 0 && (
        <div className="bg-slate-900/90 backdrop-blur-2xl p-4 border-t border-white/5 shadow-2xl">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap justify-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <span className="bg-slate-800 px-3 py-1 rounded-full text-slate-400 border border-white/5">{t.total}: {state.items.length}</span>
              <span className="bg-green-500/10 px-3 py-1 rounded-full text-green-500 border border-green-500/20">{t.successCount}: {state.items.filter(i => i.status === 'completed').length}</span>
              <span className="bg-yellow-500/10 px-3 py-1 rounded-full text-yellow-500 border border-yellow-500/20">{t.processingCount}: {state.items.filter(i => i.status === 'processing').length}</span>
              <span className="bg-red-500/10 px-3 py-1 rounded-full text-red-500 border border-red-500/20">{t.failedCount}: {state.items.filter(i => i.status === 'error').length}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium italic opacity-60">{t.note}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const TypeIcon: React.FC<{ type: VehicleType }> = ({ type }) => {
  switch (type) {
    case VehicleType.PRIVATE: return <i className="fa-solid fa-car text-blue-400"></i>;
    case VehicleType.TAXI: return <i className="fa-solid fa-taxi text-yellow-400"></i>;
    case VehicleType.POLICE: return <i className="fa-solid fa-shield-halved text-red-500"></i>;
    case VehicleType.AMBULANCE: return <i className="fa-solid fa-truck-medical text-green-400"></i>;
    default: return <i className="fa-solid fa-car-rear text-slate-400"></i>;
  }
};

export default App;
