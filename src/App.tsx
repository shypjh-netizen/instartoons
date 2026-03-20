/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, User, BookOpen, Download, RefreshCw, Send, Image as ImageIcon, Loader2, Save, Trash2, LogIn } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateCharacter, generateScript, generatePanelImage } from './services/geminiService';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';

type Tab = 'character' | 'script' | 'gallery';
type Style = 'minimal' | 'standard' | 'detailed' | 'retro';

interface SavedCharacter {
  id: string;
  userId: string;
  name: string;
  imageUrl: string;
  description: string;
  style: string;
  createdAt: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('character');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  // Character State
  const [charName, setCharName] = useState('');
  const [charDescription, setCharDescription] = useState('');
  const [charStyle, setCharStyle] = useState<Style>('standard');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<SavedCharacter | null>(null);

  // Persistence: Load selected character ID from localStorage
  useEffect(() => {
    const savedId = localStorage.getItem('selectedCharacterId');
    if (savedId && savedCharacters.length > 0) {
      const found = savedCharacters.find(c => c.id === savedId);
      if (found) setSelectedCharacter(found);
    }
  }, [savedCharacters]);

  // Persistence: Save selected character ID to localStorage
  useEffect(() => {
    if (selectedCharacter) {
      localStorage.setItem('selectedCharacterId', selectedCharacter.id);
    }
  }, [selectedCharacter]);

  // Script State
  const [scriptTopic, setScriptTopic] = useState('');
  const [scriptCharacters, setScriptCharacters] = useState('');
  const [panelCount, setPanelCount] = useState(4);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [scriptPanels, setScriptPanels] = useState<any[]>([]);
  const [panelImages, setPanelImages] = useState<(string | null)[]>([]);
  const [panelLoading, setPanelLoading] = useState<boolean[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedCharacters([]);
      return;
    }

    const q = query(
      collection(db, 'characters'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chars = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedCharacter[];
      setSavedCharacters(chars);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (savedCharacters.length > 0 && !selectedCharacter) {
      const savedId = localStorage.getItem('selectedCharacterId');
      const found = savedCharacters.find(c => c.id === savedId);
      setSelectedCharacter(found || savedCharacters[0]);
    } else if (savedCharacters.length === 0) {
      setSelectedCharacter(null);
    }
  }, [savedCharacters, selectedCharacter]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error(error);
      alert('로그인에 실패했습니다.');
    }
  };

  const handleGenerateCharacter = async () => {
    if (!charDescription) return;
    setLoading(true);
    try {
      const img = await generateCharacter(charDescription, charStyle);
      setGeneratedImage(img);
    } catch (error) {
      console.error(error);
      alert('캐릭터 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!user || !generatedImage || !charName) {
      alert('로그인이 필요하거나 캐릭터 이름/이미지가 없습니다.');
      return;
    }
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'characters'), {
        userId: user.uid,
        name: charName,
        imageUrl: generatedImage,
        description: charDescription,
        style: charStyle,
        createdAt: serverTimestamp()
      });
      // Auto-select the newly saved character
      localStorage.setItem('selectedCharacterId', docRef.id);
      alert('캐릭터가 저장되었습니다!');
    } catch (error) {
      console.error(error);
      alert('저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!scriptTopic) return;
    setLoading(true);
    setGeneratedScript(null);
    setScriptPanels([]);
    setPanelImages(new Array(panelCount).fill(null));
    setPanelLoading(new Array(panelCount).fill(false));
    try {
      const mainChar = selectedCharacter ? { name: selectedCharacter.name, description: selectedCharacter.description } : undefined;
      const data = await generateScript(scriptTopic, scriptCharacters, panelCount, mainChar);
      setGeneratedScript(data.scriptMarkdown);
      setScriptPanels(data.panels);
    } catch (error) {
      console.error(error);
      alert('대본 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePanelImage = async (index: number) => {
    const panel = scriptPanels[index];
    if (!panel) return;

    const newPanelLoading = [...panelLoading];
    newPanelLoading[index] = true;
    setPanelLoading(newPanelLoading);

    try {
      const charContext = selectedCharacter ? `${selectedCharacter.name} (${selectedCharacter.description})` : undefined;
      const img = await generatePanelImage(panel.imagePrompt, selectedCharacter?.style || charStyle, charContext);
      const newPanelImages = [...panelImages];
      newPanelImages[index] = img;
      setPanelImages(newPanelImages);
    } catch (error) {
      console.error(error);
      alert(`${index + 1}번 컷 이미지 생성에 실패했습니다.`);
    } finally {
      const resetPanelLoading = [...panelLoading];
      resetPanelLoading[index] = false;
      setPanelLoading(resetPanelLoading);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Instatoon Creator</h1>
          </div>
          <nav className="flex gap-1 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('character')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'character' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              캐릭터 생성
            </button>
            <button
              onClick={() => setActiveTab('script')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'script' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              대본 생성
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'gallery' ? 'bg-white shadow-sm text-emerald-600' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              갤러리
            </button>
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-stone-200" />
                <span className="text-xs font-medium text-stone-600 hidden sm:inline">{user.displayName}</span>
                <button onClick={() => auth.signOut()} className="text-xs text-stone-400 hover:text-stone-600">로그아웃</button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-all"
              >
                <LogIn size={14} />
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'character' ? (
            <motion.div
              key="character"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-8"
            >
              {/* Input Section */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                  <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <User size={20} />
                    <h2 className="font-semibold">캐릭터 설정</h2>
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">캐릭터 이름</label>
                    <input
                      type="text"
                      value={charName}
                      onChange={(e) => setCharName(e.target.value)}
                      placeholder="예: 멍이, 냥이"
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-2 ml-1">그림체 선택</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['minimal', 'standard', 'detailed', 'retro'] as Style[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setCharStyle(s)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                            charStyle === s
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300'
                          }`}
                        >
                          {s === 'minimal' && '초간단'}
                          {s === 'standard' && '표준'}
                          {s === 'detailed' && '고퀄리티'}
                          {s === 'retro' && '레트로'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-stone-500 mb-4">
                    원하는 캐릭터의 특징을 자세히 적어주세요.
                  </p>
                  <textarea
                    value={charDescription}
                    onChange={(e) => setCharDescription(e.target.value)}
                    placeholder="예: 안경을 쓴 귀여운 갈색 강아지, 노란색 후드티를 입고 있음, 항상 웃는 얼굴"
                    className="w-full h-32 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none text-sm"
                  />
                  <button
                    onClick={handleGenerateCharacter}
                    disabled={loading || !charDescription}
                    className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    캐릭터 생성하기
                  </button>
                  {generatedImage && user && (
                    <button
                      onClick={handleSaveCharacter}
                      disabled={loading}
                      className="w-full mt-2 bg-white border border-emerald-200 text-emerald-600 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:bg-emerald-50"
                    >
                      <Save size={20} />
                      갤러리에 저장
                    </button>
                  )}
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Tip</h3>
                  <p className="text-xs text-emerald-600 leading-relaxed">
                    인스타툰은 단순하고 명확한 캐릭터가 인기가 많아요! <br/>
                    선이 굵고 색감이 뚜렷한 디자인을 추천합니다.
                  </p>
                </div>
              </div>

              {/* Preview Section */}
              <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden relative">
                {generatedImage ? (
                  <>
                    <img
                      src={generatedImage}
                      alt="Generated Character"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <a
                        href={generatedImage}
                        download="character.png"
                        className="p-2 bg-white/90 backdrop-blur shadow-lg rounded-full text-stone-700 hover:text-emerald-600 transition-colors"
                      >
                        <Download size={20} />
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-300 mx-auto mb-4">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-stone-400 text-sm">생성된 캐릭터가 여기에 표시됩니다.</p>
                  </div>
                )}
                {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-emerald-500" size={40} />
                      <p className="text-sm font-medium text-stone-600">캐릭터를 그리는 중...</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'script' ? (
            <motion.div
              key="script"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 gap-8"
            >
              {/* ... existing script code ... */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                  <div className="flex items-center gap-2 mb-4 text-emerald-600">
                    <BookOpen size={20} />
                    <h2 className="font-semibold">스토리 설정</h2>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5 ml-1">주인공 선택</label>
                      {savedCharacters.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {savedCharacters.map((char) => (
                            <button
                              key={char.id}
                              onClick={() => setSelectedCharacter(char)}
                              className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                selectedCharacter?.id === char.id ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-500'
                              }`}
                            >
                              <img src={char.imageUrl} alt={char.name} className="w-6 h-6 rounded-full object-cover" />
                              {char.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-stone-50 border border-dashed border-stone-200 rounded-xl text-center">
                          <p className="text-[10px] text-stone-400">
                            저장된 캐릭터가 없습니다. <br/>
                            '캐릭터 생성' 탭에서 캐릭터를 먼저 저장해주세요!
                          </p>
                        </div>
                      )}
                      {selectedCharacter && (
                        <p className="text-[10px] text-emerald-600 mt-1 ml-1">
                          선택됨: {selectedCharacter.name} ({selectedCharacter.style})
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5 ml-1">컷 수 선택 ({panelCount}컷)</label>
                      <div className="flex items-center gap-4 px-2">
                        <input
                          type="range"
                          min="4"
                          max="20"
                          step="1"
                          value={panelCount}
                          onChange={(e) => setPanelCount(parseInt(e.target.value))}
                          className="flex-1 h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-sm font-bold text-emerald-600 w-8 text-right">{panelCount}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5 ml-1">주제 / 상황</label>
                      <input
                        type="text"
                        value={scriptTopic}
                        onChange={(e) => setScriptTopic(e.target.value)}
                        placeholder="예: 월요병에 걸린 직장인, 다이어트 결심"
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5 ml-1">등장인물 (선택)</label>
                      <input
                        type="text"
                        value={scriptCharacters}
                        onChange={(e) => setScriptCharacters(e.target.value)}
                        placeholder="예: 소심한 강아지 '멍이', 활발한 고양이 '냥이'"
                        className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateScript}
                    disabled={loading || !scriptTopic}
                    className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    대본 생성하기
                  </button>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Tip</h3>
                  <p className="text-xs text-emerald-600 leading-relaxed">
                    인스타툰은 공감 포인트가 중요해요! <br/>
                    일상 속 소소한 불편함이나 즐거움을 주제로 잡아보세요.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden relative flex flex-col">
                <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Script & Panels</span>
                  {generatedScript && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedScript || '');
                        alert('클립보드에 복사되었습니다!');
                      }}
                      className="text-xs text-emerald-600 font-medium hover:underline"
                    >
                      Copy Script
                    </button>
                  )}
                </div>
                <div className="flex-1 p-6 overflow-y-auto max-h-[800px]">
                  {generatedScript ? (
                    <div className="space-y-8">
                      <div className="prose prose-sm prose-emerald prose-stone max-w-none">
                        <ReactMarkdown>{generatedScript}</ReactMarkdown>
                      </div>
                      
                      <div className="border-t border-stone-100 pt-8">
                        <h3 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                          <ImageIcon size={16} />
                          컷별 이미지 생성
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {scriptPanels.map((panel, idx) => (
                            <div key={idx} className="bg-stone-50 rounded-xl border border-stone-200 overflow-hidden flex flex-col">
                              <div className="aspect-square bg-stone-200 relative flex items-center justify-center">
                                {panelImages[idx] ? (
                                  <img 
                                    src={panelImages[idx]!} 
                                    alt={`Panel ${idx + 1}`} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="text-center p-4">
                                    <ImageIcon size={24} className="text-stone-400 mx-auto mb-2" />
                                    <p className="text-[10px] text-stone-400">이미지가 없습니다.</p>
                                  </div>
                                )}
                                {panelLoading[idx] && (
                                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                    <Loader2 className="animate-spin text-emerald-500" size={24} />
                                  </div>
                                )}
                              </div>
                              <div className="p-3 flex-1 flex flex-col">
                                <div className="text-[11px] text-stone-600 mb-3 flex-1 leading-relaxed">
                                  <span className="font-bold text-emerald-600 mr-1">#{panel.panelNumber}</span>
                                  {panel.content}
                                </div>
                                <button
                                  onClick={() => handleGeneratePanelImage(idx)}
                                  disabled={panelLoading[idx]}
                                  className="w-full py-2 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-stone-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 transition-all flex items-center justify-center gap-1.5"
                                >
                                  {panelLoading[idx] ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                  {panelImages[idx] ? '다시 생성' : '이미지 생성'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center text-stone-300 mx-auto mb-4">
                        <BookOpen size={32} />
                      </div>
                      <p className="text-stone-400 text-sm">생성된 대본이 여기에 표시됩니다.</p>
                    </div>
                  )}
                </div>
                {loading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="animate-spin text-emerald-500" size={40} />
                      <p className="text-sm font-medium text-stone-600">스토리를 짜는 중...</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-stone-800">나의 캐릭터 갤러리</h2>
                <p className="text-sm text-stone-500">{savedCharacters.length}개의 캐릭터 저장됨</p>
              </div>

              {!user ? (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-stone-300 text-center">
                  <p className="text-stone-500 mb-4">갤러리를 이용하려면 로그인이 필요합니다.</p>
                  <button
                    onClick={handleLogin}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all"
                  >
                    Google로 로그인하기
                  </button>
                </div>
              ) : savedCharacters.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-stone-300 text-center">
                  <p className="text-stone-500">아직 저장된 캐릭터가 없습니다. 캐릭터를 생성하고 저장해보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {savedCharacters.map((char) => (
                    <div key={char.id} className="group relative bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden aspect-square">
                      <img src={char.imageUrl} alt={char.description} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        <p className="text-[10px] text-white text-center line-clamp-2 px-2">{char.description}</p>
                        <div className="flex gap-2 mt-1">
                          <a
                            href={char.imageUrl}
                            download={`${char.name}.png`}
                            className="p-1.5 bg-white rounded-full text-stone-700 hover:text-emerald-600"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 border-t border-stone-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-stone-400 text-sm">
          <p>© 2026 Instatoon Creator. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Terms</a>
            <a href="#" className="hover:text-emerald-500 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
