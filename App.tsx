import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import PharmacyCard from './components/PharmacyCard';
import { SearchIcon, LoaderIcon, MapPinIcon, LocateFixedIcon, CameraIcon, XIcon, UploadIcon, BoxIcon } from './components/Icons';
import { SearchState, Coordinates, PharmacyResult } from './types';
import { findPharmacies, getPincodeFromCoordinates, analyzePrescription, checkMedicineStock, getPharmacyHours } from './services/geminiService';

const App = () => {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    aiSummary: '',
    isLoading: false,
    error: null,
    location: null,
    locationStatus: 'idle',
  });

  const [isDetectingPincode, setIsDetectingPincode] = useState(false);
  const [loadingHoursId, setLoadingHoursId] = useState<string | null>(null);
  
  // Modal States
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [isAnalyzingPrescription, setIsAnalyzingPrescription] = useState(false);
  const [prescriptionMedicines, setPrescriptionMedicines] = useState<string>('');
  
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyResult | null>(null);
  const [stockQuery, setStockQuery] = useState('');
  const [stockResult, setStockResult] = useState('');
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestLocation = useCallback(async (): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setState(prev => ({ ...prev, locationStatus: 'denied', error: 'Geolocation not supported by your browser' }));
        resolve(null);
        return;
      }

      setState(prev => ({ ...prev, locationStatus: 'requesting' }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setState(prev => ({
            ...prev,
            location: coords,
            locationStatus: 'granted'
          }));
          resolve(coords);
        },
        (error) => {
          console.warn("Location access denied or failed", error);
          setState(prev => ({ ...prev, locationStatus: 'denied' }));
          resolve(null);
        }
      );
    });
  }, []);

  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    
    const searchTerm = (overrideQuery !== undefined ? overrideQuery : state.query).trim();
    const finalQuery = searchTerm || "pharmacies near me";

    if (overrideQuery !== undefined) {
      setState(prev => ({ ...prev, query: overrideQuery }));
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, results: [], aiSummary: '' }));

    try {
      const data = await findPharmacies(finalQuery, state.location);
      setState(prev => ({
        ...prev,
        isLoading: false,
        results: data.pharmacies,
        aiSummary: data.summary
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "We couldn't reach the search service. Please try again."
      }));
    }
  };

  const handleUsePincode = async () => {
    setIsDetectingPincode(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      let coords = state.location;
      if (!coords) {
        coords = await requestLocation();
      }

      if (!coords) {
        setIsDetectingPincode(false);
        setState(prev => ({ ...prev, error: "Location access is required to detect your pincode." }));
        return;
      }

      const pincode = await getPincodeFromCoordinates(coords.latitude, coords.longitude);
      
      if (pincode) {
        await handleSearch(undefined, pincode);
      } else {
        setState(prev => ({ ...prev, error: "Could not detect pincode for your location." }));
      }
    } catch (error) {
      console.error(error);
      setState(prev => ({ ...prev, error: "Failed to detect pincode." }));
    } finally {
      setIsDetectingPincode(false);
    }
  };

  const handleCheckHours = async (pharmacy: PharmacyResult) => {
    if (loadingHoursId === pharmacy.id) return;
    setLoadingHoursId(pharmacy.id);

    try {
        const hours = await getPharmacyHours(pharmacy.name, state.location);
        setState(prev => ({
            ...prev,
            results: prev.results.map(p => 
                p.id === pharmacy.id ? { ...p, openingHours: hours } : p
            )
        }));
    } catch (error) {
        console.error("Failed to check hours", error);
    } finally {
        setLoadingHoursId(null);
    }
  };

  // Prescription Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingPrescription(true);
    setPrescriptionMedicines('');
    
    const reader = new FileReader();
    reader.onloadend = async () => {
        try {
            const base64String = (reader.result as string).split(',')[1];
            const medicines = await analyzePrescription(base64String);
            setPrescriptionMedicines(medicines);
        } catch (error) {
            setPrescriptionMedicines("Error analyzing image.");
        } finally {
            setIsAnalyzingPrescription(false);
        }
    };
    reader.readAsDataURL(file);
  };

  const handlePrescriptionSearch = () => {
      setShowPrescriptionModal(false);
      handleSearch(undefined, `Pharmacies with stock of: ${prescriptionMedicines}`);
  };

  // Stock Check Logic
  const openStockModal = (pharmacy: PharmacyResult) => {
      setSelectedPharmacy(pharmacy);
      setStockResult('');
      setStockQuery('');
      setShowStockModal(true);
  };

  const handleStockCheck = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPharmacy || !stockQuery) return;

      setIsCheckingStock(true);
      try {
          const result = await checkMedicineStock(selectedPharmacy.name, stockQuery);
          setStockResult(result);
      } catch (err) {
          setStockResult("Could not verify stock.");
      } finally {
          setIsCheckingStock(false);
      }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <Header />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero / Search Section */}
        <section className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Find health services, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-blue-500">
              right when you need them.
            </span>
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Powered by AI to find open pharmacies, check stock, and analyze prescriptions.
          </p>

          <form onSubmit={(e) => handleSearch(e)} className="relative w-full max-w-xl mx-auto group z-20">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-blue-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-white rounded-2xl shadow-xl p-2 flex items-center gap-2 border border-slate-100">
              <div className="pl-3 text-slate-400">
                <SearchIcon className="w-6 h-6" />
              </div>
              <input
                type="text"
                value={state.query}
                onChange={(e) => setState(prev => ({ ...prev, query: e.target.value }))}
                placeholder={state.location ? "Enter Medicine, Pincode or Pharmacy..." : "Enter City, Pincode or Pharmacy..."}
                className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-slate-400 h-12 text-slate-800 min-w-0"
              />
              
              {/* Action Buttons Group */}
              <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => setShowPrescriptionModal(true)}
                    className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                    title="Scan Prescription"
                >
                    <CameraIcon className="w-5 h-5" />
                </button>

                <button
                    type="button"
                    onClick={handleUsePincode}
                    disabled={isDetectingPincode || state.isLoading}
                    className="hidden sm:flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                    title="Use current location pincode"
                >
                    {isDetectingPincode ? (
                    <LoaderIcon className="w-5 h-5 animate-spin text-teal-500" />
                    ) : (
                    <LocateFixedIcon className="w-5 h-5" />
                    )}
                </button>
              </div>

              <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

              <button
                type="submit"
                disabled={state.isLoading || isDetectingPincode}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 h-12 font-medium transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
              >
                {state.isLoading ? (
                  <>
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                    Searching
                  </>
                ) : (
                  'Find'
                )}
              </button>
            </div>
          </form>

          {/* Mobile Buttons */}
          <div className="sm:hidden mt-4 flex justify-center gap-3">
             <button
                type="button"
                onClick={handleUsePincode}
                disabled={isDetectingPincode || state.isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium shadow-sm active:scale-95 transition-all"
              >
                 {isDetectingPincode ? (
                   <LoaderIcon className="w-4 h-4 animate-spin text-teal-500" />
                 ) : (
                   <LocateFixedIcon className="w-4 h-4 text-teal-500" />
                 )}
                 Pincode
              </button>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium shadow-sm active:scale-95 transition-all"
              >
                 <CameraIcon className="w-4 h-4 text-teal-500" />
                 Scan Rx
              </button>
          </div>

          <div className="mt-4 flex justify-center">
            {state.locationStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium cursor-help" title="Location access granted">
                <MapPinIcon className="w-3 h-3" /> GPS Active
              </span>
            ) : state.locationStatus === 'requesting' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                 <LoaderIcon className="w-3 h-3 animate-spin" /> Locating you...
              </span>
            ) : (
              <button 
                onClick={() => requestLocation()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-medium transition-colors"
              >
                <MapPinIcon className="w-3 h-3" /> Enable Location
              </button>
            )}
          </div>
        </section>

        {/* Results Area */}
        <div className="space-y-8">
          
          {/* AI Summary */}
          {state.aiSummary && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-4xl mx-auto animate-fade-in-up">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-md">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900">PharmaLocate Insight</h3>
                  <div className="text-slate-600 leading-relaxed text-sm md:text-base prose prose-slate">
                     {state.aiSummary}
                  </div>
                </div>
              </div>
            </div>
          )}

          {state.error && (
             <div className="max-w-lg mx-auto bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-xl text-center animate-pulse">
               {state.error}
             </div>
          )}

          {!state.isLoading && state.results.length === 0 && !state.error && !state.aiSummary && (
            <div className="text-center py-20 text-slate-400">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPinIcon className="w-10 h-10 opacity-40 text-slate-500" />
              </div>
              <p className="text-lg font-medium text-slate-500">Ready to help you find care nearby.</p>
              <p className="text-sm mt-2 opacity-70">Search by medicine, pharmacy name, or upload a prescription.</p>
            </div>
          )}

          {state.results.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.results.map((pharmacy) => (
                <PharmacyCard 
                    key={pharmacy.id} 
                    pharmacy={pharmacy} 
                    onCheckStock={openStockModal}
                    onCheckHours={handleCheckHours}
                    isLoadingHours={loadingHoursId === pharmacy.id}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 py-8 mt-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} PharmaLocate. Powered by Gemini Maps Grounding.</p>
        </div>
      </footer>

      {/* Prescription Modal */}
      {showPrescriptionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowPrescriptionModal(false)}></div>
              <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <CameraIcon className="w-5 h-5 text-teal-500" />
                          Scan Prescription
                      </h3>
                      <button onClick={() => setShowPrescriptionModal(false)} className="text-slate-400 hover:text-slate-600">
                          <XIcon className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-teal-400 transition-colors"
                      >
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                          />
                          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-3">
                              <UploadIcon className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-medium text-slate-700">Tap to upload image</p>
                          <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG</p>
                      </div>

                      {isAnalyzingPrescription && (
                          <div className="text-center py-4 text-teal-600 flex items-center justify-center gap-2">
                              <LoaderIcon className="w-5 h-5 animate-spin" />
                              Analyzing prescription...
                          </div>
                      )}

                      {prescriptionMedicines && !isAnalyzingPrescription && (
                          <div className="bg-slate-50 rounded-xl p-4">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Detected Medicines</p>
                              <p className="text-slate-800 font-medium">{prescriptionMedicines}</p>
                          </div>
                      )}

                      <button 
                        onClick={handlePrescriptionSearch}
                        disabled={!prescriptionMedicines || isAnalyzingPrescription}
                        className="w-full bg-slate-900 text-white rounded-xl py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                      >
                          Find Pharmacies
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Stock Check Modal */}
      {showStockModal && selectedPharmacy && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowStockModal(false)}></div>
               <div className="relative bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                          <h3 className="text-xl font-bold text-slate-900">Check Stock</h3>
                          <p className="text-sm text-slate-500">{selectedPharmacy.name}</p>
                      </div>
                      <button onClick={() => setShowStockModal(false)} className="text-slate-400 hover:text-slate-600">
                          <XIcon className="w-6 h-6" />
                      </button>
                   </div>

                   <form onSubmit={handleStockCheck} className="space-y-4">
                       <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name</label>
                           <input 
                              type="text" 
                              required
                              value={stockQuery}
                              onChange={(e) => setStockQuery(e.target.value)}
                              placeholder="e.g. Amoxicillin 500mg"
                              className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                           />
                       </div>
                       
                       {stockResult && (
                           <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                               <strong>Status:</strong> {stockResult}
                           </div>
                       )}

                       <button 
                         type="submit"
                         disabled={isCheckingStock || !stockQuery}
                         className="w-full bg-teal-600 text-white rounded-xl py-3 font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                       >
                           {isCheckingStock ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <BoxIcon className="w-5 h-5" />}
                           Check Availability
                       </button>
                   </form>
               </div>
          </div>
      )}

    </div>
  );
};

export default App;