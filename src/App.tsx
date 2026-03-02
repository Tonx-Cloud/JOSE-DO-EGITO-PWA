import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppView } from './types';
import { interpretDream, transcribeAudio, generateNarrationAudio } from './services/gemini';

// ─── Hook: PWA Install Prompt ──────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Detectar se já está standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt && !isInstalled, install, isInstalled };
};

// ─── Ícones SVG ────────────────────────────────────────────────────────────

const MicIcon = ({ className = 'w-12 h-12' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
  </svg>
);

const SpeakerIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const DownloadIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const InstallIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-9l-4 4m0 0L8 7m4 4V3" />
  </svg>
);

// ─── Ícones Menu ───────────────────────────────────────────────────────────

const HamburgerIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type MenuPage = null | 'sobre' | 'como-funciona' | 'contato' | 'ajude';

// ─── Componente Principal ──────────────────────────────────────────────────

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('welcome');
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<MenuPage>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

  const { canInstall, install } = useInstallPrompt();

  // ─── Welcome → Home (auto-transição 4s) ──────────────────

  useEffect(() => {
    if (view !== 'welcome') return;
    const fadeTimer = setTimeout(() => setWelcomeFading(true), 3500);
    const navTimer = setTimeout(() => setView('home'), 4500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [view]);

  // ─── Helpers ──────────────────────────────────────────────

  const cleanForSpeech = (text: string) =>
    text.replace(/[#*_~`>]/g, '').replace(/\n\n/g, '. ').replace(/\n/g, ' ').trim();

  const speakWithBrowserTTS = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(interpretation));
    utterance.lang = 'pt-BR';
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [interpretation, isSpeaking]);

  const stopAllAudio = useCallback(() => {
    window.speechSynthesis?.cancel();
    narrationAudioRef.current?.pause();
    setIsSpeaking(false);
  }, []);

  // ─── Download Texto ───────────────────────────────────────

  const downloadText = () => {
    const blob = new Blob(
      [`JOSÉ DO EGITO - INTERPRETAÇÃO DO SEU SONHO\n${'═'.repeat(45)}\n\nSeu relato:\n"${transcription}"\n\nInterpretação:\n${interpretation}\n`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jose-do-egito-interpretacao.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Download Áudio Narrado (Gemini TTS) ──────────────────

  const downloadNarration = async () => {
    setNarrationLoading(true);
    setError(null);
    try {
      const blob = await generateNarrationAudio(interpretation);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jose-do-egito-narracao.mp3';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Não foi possível gerar a narração em áudio. Tente "Ouvir" com a voz do navegador.');
    } finally {
      setNarrationLoading(false);
    }
  };

  // ─── Gravação de Áudio ────────────────────────────────────

  const startRecording = async () => {
    setError(null);
    setTranscription('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Transcrever automaticamente
        setView('transcribing');
        setIsLoading(true);
        setLoadingMsg('Ouvindo seu relato...');
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64 = reader.result?.toString().split(',')[1];
            if (!base64) throw new Error('Falha ao converter áudio');
            const text = await transcribeAudio(base64, 'audio/webm');
            setTranscription(text);
            setView('confirming');
            setIsLoading(false);
          };
        } catch {
          setError('Não foi possível transcrever. Tente novamente ou digite seu sonho.');
          setView('home');
          setIsLoading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setView('recording');
    } catch {
      setError('Não conseguimos acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  // ─── Interpretação ────────────────────────────────────────

  const handleInterpret = async () => {
    if (transcription.trim().length < 5) return;
    setIsLoading(true);
    setError(null);
    setView('interpreting');
    setLoadingMsg('José do Egito está analisando seu sonho...');
    try {
      const result = await interpretDream(transcription);
      setInterpretation(result || 'Não foi possível interpretar.');
      setView('result');
    } catch {
      setInterpretation('Infelizmente não consegui interpretar seu sonho agora. Por favor, tente novamente.');
      setView('result');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSession = () => {
    stopAllAudio();
    setView('home');
    setInterpretation('');
    setTranscription('');
    setError(null);
  };

  // ─── Renderização ─────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-night-DEFAULT text-slate-100 font-body safe-top safe-bottom">

      {/* ═══════════════ TELA: BOAS-VINDAS ═══════════════ */}
      {view === 'welcome' && (
        <div
          className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-8
            bg-night-DEFAULT transition-all duration-1000
            ${welcomeFading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
          onClick={() => { setWelcomeFading(true); setTimeout(() => setView('home'), 500); }}
        >
          {/* Background decorativo */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[10%] left-[5%] w-[50%] h-[50%] bg-gold/20 rounded-full blur-[150px] animate-pulse" />
            <div className="absolute bottom-[10%] right-[5%] w-[40%] h-[40%] bg-indigo-900/30 rounded-full blur-[120px]" />
          </div>

          {/* Estrela animada */}
          <div className="welcome-star mb-8 text-gold">
            <svg className="w-24 h-24 sm:w-32 sm:h-32" viewBox="0 0 100 100" fill="currentColor">
              <polygon points="50,5 63,35 95,35 69,55 78,88 50,68 22,88 31,55 5,35 37,35" opacity="0.9" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold text-gold text-center leading-snug mb-6 welcome-fade-in">
            Bem-vindo ao<br />José do Egito
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 text-center leading-relaxed max-w-lg welcome-fade-in-delay font-light">
            Seu interpretador de sonhos segundo a<br />
            <span className="text-gold font-medium">sabedoria e orientação divina</span>.
          </p>

          <p className="mt-8 text-lg text-slate-400 text-center leading-relaxed max-w-md welcome-fade-in-delay2">
            Me conte seu sonho e eu revelarei o que está escrito nas estrelas para você. ✦
          </p>

          <p className="mt-12 text-base text-slate-600 animate-pulse">
            Toque para continuar
          </p>
        </div>
      )}

      {/* Background decorativo (telas internas) */}
      {view !== 'welcome' && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-15">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900 rounded-full blur-[100px]" />
        </div>
      )}

      {/* Header com menu e botão instalar (exceto welcome) */}
      {view !== 'welcome' && (
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-night-DEFAULT/80 backdrop-blur-md border-b border-white/5">
          {/* Menu Hamburger */}
          <button
            onClick={() => { setMenuOpen(!menuOpen); setMenuPage(null); }}
            aria-label="Menu"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gold hover:bg-gold/10 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-gold/40"
          >
            {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>

          {/* Título central */}
          <div className="text-center">
            <h1 className="text-lg sm:text-xl font-display font-bold text-gold leading-tight uppercase tracking-tight">
              ✦ José do Egito ✦
            </h1>
          </div>

          {/* Botão Instalar (canto direito) */}
          {canInstall ? (
            <button
              onClick={install}
              aria-label="Instalar no celular"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-gold hover:bg-gold/10 active:scale-90 transition-all focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              <InstallIcon />
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
        </header>
      )}

      {/* Spacer para compensar header fixo */}
      {view !== 'welcome' && <div className="h-16" />}

      {/* ═══════ MENU LATERAL ═══════ */}
      {menuOpen && view !== 'welcome' && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => { setMenuOpen(false); setMenuPage(null); }}
          />
          {/* Painel do menu */}
          <nav className="fixed top-0 left-0 bottom-0 w-[80%] max-w-xs bg-night-DEFAULT border-r border-white/10 z-50 flex flex-col shadow-2xl menu-slide-in">
            {/* Cabeçalho do menu */}
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-display font-bold text-gold">✦ Menu</h2>
            </div>

            {menuPage === null ? (
              /* Lista de itens do menu */
              <div className="flex-1 py-4">
                <button
                  onClick={() => setMenuPage('sobre')}
                  className="w-full text-left px-6 py-4 text-lg text-slate-200 hover:bg-gold/10 hover:text-gold transition-all flex items-center gap-4"
                >
                  <span className="text-2xl">👤</span> Sobre Nós
                </button>
                <button
                  onClick={() => setMenuPage('como-funciona')}
                  className="w-full text-left px-6 py-4 text-lg text-slate-200 hover:bg-gold/10 hover:text-gold transition-all flex items-center gap-4"
                >
                  <span className="text-2xl">💡</span> Como Funciona
                </button>
                <button
                  onClick={() => setMenuPage('contato')}
                  className="w-full text-left px-6 py-4 text-lg text-slate-200 hover:bg-gold/10 hover:text-gold transition-all flex items-center gap-4"
                >
                  <span className="text-2xl">✉️</span> Contato
                </button>
                <div className="my-2 mx-6 border-t border-white/5" />
                <button
                  onClick={() => setMenuPage('ajude')}
                  className="w-full text-left px-6 py-4 text-lg text-slate-200 hover:bg-gold/10 hover:text-gold transition-all flex items-center gap-4"
                >
                  <span className="text-2xl">❤️</span> Ajude o Desenvolvedor
                </button>
              </div>
            ) : (
              /* Conteúdo da página selecionada */
              <div className="flex-1 overflow-y-auto">
                <button
                  onClick={() => setMenuPage(null)}
                  className="w-full text-left px-6 py-3 text-sm text-gold hover:bg-gold/10 transition-all flex items-center gap-2 border-b border-white/5"
                >
                  ← Voltar
                </button>

                {menuPage === 'sobre' && (
                  <div className="p-6 space-y-4">
                    <h3 className="text-xl font-display font-bold text-gold">Sobre Nós</h3>
                    <p className="text-base text-slate-300 leading-relaxed">
                      O <strong className="text-gold">José do Egito</strong> é um aplicativo de
                      interpretação de sonhos baseado na sabedoria bíblica.
                    </p>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Inspirado no personagem bíblico José, que recebeu de Deus o dom de
                      interpretar sonhos, nosso app usa inteligência artificial para oferecer
                      interpretações espirituais, simbólicas e práticas dos seus sonhos.
                    </p>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Desenvolvido com carinho especialmente para pessoas que buscam
                      orientação e significado espiritual em seus sonhos. ✦
                    </p>
                  </div>
                )}

                {menuPage === 'como-funciona' && (
                  <div className="p-6 space-y-4">
                    <h3 className="text-xl font-display font-bold text-gold">Como Funciona</h3>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <span className="text-2xl">🎤</span>
                        <div>
                          <p className="text-base font-semibold text-gold">1. Conte seu sonho</p>
                          <p className="text-sm text-slate-400">Grave um áudio ou digite o que você sonhou.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <p className="text-base font-semibold text-gold">2. Confira o texto</p>
                          <p className="text-sm text-slate-400">Se gravou áudio, confira a transcrição e edite se necessário.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-2xl">✨</span>
                        <div>
                          <p className="text-base font-semibold text-gold">3. Receba a interpretação</p>
                          <p className="text-sm text-slate-400">José do Egito analisará seu sonho com sabedoria bíblica.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="text-2xl">🔊</span>
                        <div>
                          <p className="text-base font-semibold text-gold">4. Ouça ou salve</p>
                          <p className="text-sm text-slate-400">Ouça a interpretação, baixe o texto ou o áudio narrado.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {menuPage === 'contato' && (
                  <div className="p-6 space-y-4">
                    <h3 className="text-xl font-display font-bold text-gold">Contato</h3>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Tem alguma dúvida, sugestão ou quer nos enviar uma mensagem?
                    </p>
                    <a
                      href="mailto:hiltonsf@gmail.com"
                      className="block w-full py-4 px-5 rounded-2xl text-lg text-center
                        bg-gold/10 border border-gold/30 text-gold
                        hover:bg-gold/20 active:scale-[0.97] transition-all"
                    >
                      ✉️ hiltonsf@gmail.com
                    </a>
                    <p className="text-sm text-slate-500 text-center">
                      Responderemos o mais breve possível.
                    </p>
                  </div>
                )}

                {menuPage === 'ajude' && (
                  <div className="p-6 space-y-5">
                    <h3 className="text-xl font-display font-bold text-gold">❤️ Ajude o Desenvolvedor</h3>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Se o José do Egito trouxe luz e significado para seus sonhos,
                      considere fazer uma contribuição para apoiar o desenvolvedor.
                    </p>
                    <p className="text-base text-slate-300 leading-relaxed">
                      Qualquer valor é bem-vindo e ajuda a manter o projeto ativo! ✦
                    </p>

                    <div className="bg-night-DEFAULT/80 border border-gold/20 rounded-2xl p-4 space-y-3">
                      <p className="text-sm text-gold font-semibold uppercase tracking-wider text-center">Chave PIX (copia e cola)</p>
                      <div className="bg-black/30 rounded-xl p-3 text-[11px] text-slate-400 break-all leading-relaxed text-center font-mono select-all">
                        00020126580014BR.GOV.BCB.PIX01366deb665d-6e79-4959-839e-6831db7307fb5204000053039865802BR5922Hilton Silva Figueredo6009SAO PAULO62140510NL03F2cJGk630489F1
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText('00020126580014BR.GOV.BCB.PIX01366deb665d-6e79-4959-839e-6831db7307fb5204000053039865802BR5922Hilton Silva Figueredo6009SAO PAULO62140510NL03F2cJGk630489F1');
                          setPixCopied(true);
                          setTimeout(() => setPixCopied(false), 3000);
                        } catch {
                          // fallback: selecionar texto manualmente
                          const el = document.querySelector('.select-all') as HTMLElement;
                          if (el) {
                            const range = document.createRange();
                            range.selectNodeContents(el);
                            const sel = window.getSelection();
                            sel?.removeAllRanges();
                            sel?.addRange(range);
                          }
                        }
                      }}
                      className={`w-full py-4 px-5 rounded-2xl font-bold text-lg text-center
                        transition-all active:scale-[0.97]
                        ${pixCopied
                          ? 'bg-green-600 text-white border border-green-500'
                          : 'bg-gold text-night-DEFAULT shadow-lg shadow-gold/20'
                        }`}
                    >
                      {pixCopied ? '✅ PIX Copiado!' : '📋 Copiar Código PIX'}
                    </button>

                    <p className="text-sm text-slate-500 text-center">
                      Abra o app do seu banco, escolha “PIX Copia e Cola” e cole o código.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Rodapé do menu */}
            <div className="p-4 border-t border-white/10 text-center">
              <p className="text-xs text-slate-600">José do Egito © 2026</p>
            </div>
          </nav>
        </>
      )}

      {/* Mensagem de erro */}
      {error && view !== 'welcome' && (
        <div className="max-w-xl w-full mb-4 z-10 p-4 bg-red-900/40 border border-red-500/30 rounded-2xl text-lg text-red-200 text-center">
          ⚠️ {error}
        </div>
      )}

      {/* ═══════════════ CONTEÚDO PRINCIPAL ═══════════════ */}
      {view !== 'welcome' && (
        <main className="w-full max-w-xl z-10 p-6 sm:p-8 rounded-[2rem] border border-white/10 shadow-2xl bg-night-50/60 backdrop-blur-xl">

          {/* ═══════ HOME ═══════ */}
          {view === 'home' && (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-display font-semibold text-gold">
                  Conte-me seu sonho
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed">
                  Grave um áudio contando seu sonho ou escreva abaixo.
                  <br />Eu irei interpretá-lo para você.
                </p>
              </div>

              {/* Botão GRAVAR grande */}
              <button
                onClick={startRecording}
                aria-label="Gravar meu sonho"
                className="w-full flex flex-col items-center justify-center gap-4 py-8 px-6
                  bg-gold/10 border-2 border-gold/30 rounded-[1.5rem]
                  hover:bg-gold/20 active:scale-[0.97] transition-all duration-200
                  focus:outline-none focus:ring-4 focus:ring-gold/40"
              >
                <div className="w-20 h-20 rounded-full bg-gold flex items-center justify-center shadow-lg shadow-gold/30">
                  <MicIcon className="w-10 h-10 text-night-DEFAULT" />
                </div>
                <span className="text-xl font-bold text-gold">🎤 Gravar Meu Sonho</span>
              </button>

              {/* Separador */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-slate-500 text-sm">ou escreva abaixo</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Textarea para digitar */}
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full h-40 bg-night-DEFAULT/60 border-2 border-white/15 rounded-2xl p-5
                  text-lg text-slate-200 leading-relaxed
                  outline-none focus:border-gold focus:ring-2 focus:ring-gold/30
                  resize-none transition-all placeholder-slate-500"
                placeholder="Escreva aqui o que você sonhou..."
              />

              {/* Botão Enviar (só se tiver texto digitado) */}
              {transcription.trim().length >= 5 && (
                <button
                  onClick={handleInterpret}
                  className="w-full py-5 px-6 rounded-2xl font-bold text-xl
                    bg-gold text-night-DEFAULT
                    active:scale-[0.97] transition-all duration-150
                    shadow-lg shadow-gold/20
                    focus:outline-none focus:ring-4 focus:ring-gold/50 min-h-[4rem]"
                >
                  ✨ Enviar para Interpretação
                </button>
              )}

            </div>
          )}

          {/* ═══════ GRAVANDO ═══════ */}
          {view === 'recording' && (
            <div className="text-center space-y-8 py-6">
              <h2 className="text-2xl font-display font-medium text-gold">
                🔴 Gravando...
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed">
                Conte agora seu sonho com calma.<br />
                Ao terminar, toque no botão abaixo.
              </p>

              {/* Indicador de gravação */}
              <div className="flex items-center justify-center gap-3">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                <div className="recording-wave flex items-end gap-1 h-8">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-gold/60 rounded-full recording-bar" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>

              {/* Botão PARAR grande */}
              <button
                onClick={stopRecording}
                aria-label="Parar gravação"
                className="w-full py-6 px-6 rounded-2xl font-bold text-xl
                  bg-red-500 text-white
                  active:scale-[0.97] transition-all duration-150
                  shadow-lg shadow-red-500/30
                  focus:outline-none focus:ring-4 focus:ring-red-300 min-h-[4rem]"
              >
                ⏹ Parar de Gravar
              </button>
            </div>
          )}

          {/* ═══════ TRANSCREVENDO ═══════ */}
          {view === 'transcribing' && (
            <div className="py-16 text-center space-y-6">
              <div className="w-16 h-16 border-4 border-gold/15 border-t-gold rounded-full animate-spin mx-auto" />
              <p className="text-xl text-gold font-display">Ouvindo seu relato...</p>
              <p className="text-base text-slate-400">Convertendo sua voz em texto.</p>
            </div>
          )}

          {/* ═══════ CONFIRMAR TRANSCRIÇÃO ═══════ */}
          {view === 'confirming' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-display font-semibold text-gold text-center">
                Confira seu relato
              </h2>
              <p className="text-base text-slate-400 text-center">
                Veja se o texto abaixo corresponde ao que você disse. Pode editar se precisar.
              </p>

              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full h-48 bg-night-DEFAULT/60 border-2 border-white/15 rounded-2xl p-5
                  text-lg text-slate-200 leading-relaxed
                  outline-none focus:border-gold focus:ring-2 focus:ring-gold/30
                  resize-none transition-all"
              />

              <button
                onClick={handleInterpret}
                disabled={transcription.trim().length < 5}
                className="w-full py-5 px-6 rounded-2xl font-bold text-xl
                  bg-gold text-night-DEFAULT
                  disabled:opacity-30 disabled:cursor-not-allowed
                  active:scale-[0.97] transition-all duration-150
                  shadow-lg shadow-gold/20
                  focus:outline-none focus:ring-4 focus:ring-gold/50 min-h-[4rem]"
              >
                ✅ Confirmar e Enviar
              </button>

              <button
                onClick={() => { setView('home'); setTranscription(''); }}
                className="w-full py-4 px-6 rounded-2xl font-medium text-lg
                  border-2 border-white/15 text-slate-300
                  active:scale-[0.97] transition-all
                  focus:outline-none focus:ring-4 focus:ring-gold/30 min-h-[3.5rem]"
              >
                🔄 Gravar Novamente
              </button>
            </div>
          )}

          {/* ═══════ INTERPRETANDO ═══════ */}
          {view === 'interpreting' && (
            <div className="py-16 text-center space-y-6">
              <div className="w-20 h-20 border-[5px] border-gold/15 border-t-gold rounded-full animate-spin mx-auto" />
              <p className="text-2xl text-gold animate-pulse font-display">
                Consultando os símbolos...
              </p>
              <p className="text-lg text-slate-400">
                José do Egito está analisando seu sonho.<br />Aguarde um momento.
              </p>
            </div>
          )}

          {/* ═══════ RESULTADO ═══════ */}
          {view === 'result' && (
            <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Relato original */}
              <div className="p-5 bg-night-DEFAULT/50 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Seu relato:</p>
                <p className="text-base text-slate-400 italic leading-relaxed">"{transcription}"</p>
              </div>

              {/* Interpretação */}
              <div className="border-t border-white/10 pt-5">
                <h3 className="text-2xl text-gold font-display font-bold mb-4">
                  ✦ Interpretação Divina
                </h3>
                <div className="text-lg text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {interpretation}
                </div>
              </div>

              {/* Ações do resultado */}
              <div className="border-t border-white/10 pt-5 space-y-3">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-3">Opções:</p>

                {/* Ouvir (Browser TTS) */}
                <button
                  onClick={speakWithBrowserTTS}
                  className="w-full py-4 px-5 rounded-2xl font-medium text-lg
                    bg-gold/10 border border-gold/20 text-gold
                    hover:bg-gold/20 active:scale-[0.97] transition-all
                    focus:outline-none focus:ring-4 focus:ring-gold/30
                    flex items-center justify-center gap-3 min-h-[3.5rem]"
                >
                  <SpeakerIcon />
                  {isSpeaking ? '⏸ Parar de Ouvir' : '🔊 Ouvir Interpretação'}
                </button>

                {/* Baixar Texto */}
                <button
                  onClick={downloadText}
                  className="w-full py-4 px-5 rounded-2xl font-medium text-lg
                    border border-white/15 text-slate-300
                    hover:bg-white/5 active:scale-[0.97] transition-all
                    focus:outline-none focus:ring-4 focus:ring-gold/30
                    flex items-center justify-center gap-3 min-h-[3.5rem]"
                >
                  <DownloadIcon />
                  📄 Baixar Texto
                </button>

                {/* Baixar Áudio Narrado */}
                <button
                  onClick={downloadNarration}
                  disabled={narrationLoading}
                  className="w-full py-4 px-5 rounded-2xl font-medium text-lg
                    border border-white/15 text-slate-300
                    hover:bg-white/5 active:scale-[0.97] transition-all
                    disabled:opacity-40 disabled:cursor-wait
                    focus:outline-none focus:ring-4 focus:ring-gold/30
                    flex items-center justify-center gap-3 min-h-[3.5rem]"
                >
                  {narrationLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-t-gold border-gold/20 rounded-full animate-spin" />
                      Gerando narração...
                    </>
                  ) : (
                    <>
                      <DownloadIcon />
                      🎧 Baixar Áudio Narrado
                    </>
                  )}
                </button>
              </div>

              {/* Nova sessão */}
              <div className="pt-3">
                <button
                  onClick={handleNewSession}
                  className="w-full py-5 px-6 rounded-2xl font-bold text-xl
                    bg-gold text-night-DEFAULT
                    active:scale-[0.97] transition-all duration-150
                    shadow-lg shadow-gold/20
                    focus:outline-none focus:ring-4 focus:ring-gold/50 min-h-[4rem]"
                >
                  ✨ Interpretar Outro Sonho
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Loading overlay genérico */}
      {isLoading && !['interpreting', 'transcribing'].includes(view) && (
        <div className="fixed inset-0 bg-night-DEFAULT/70 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-6">
          <div className="w-14 h-14 border-4 border-t-gold border-gold/10 rounded-full animate-spin" />
          <p className="text-xl text-gold">{loadingMsg || 'Processando...'}</p>
        </div>
      )}

      {/* Footer */}
      {view !== 'welcome' && (
        <footer className="mt-6 text-slate-600 text-[11px] tracking-widest uppercase z-10 text-center">
          JOSÉ DO EGITO • INTERPRETADOR DE SONHOS<br />
          <span className="text-slate-700">POWERED BY GEMINI AI</span><br />
          <span className="text-slate-500 normal-case tracking-normal text-[10px] mt-1 inline-block">By Ton Figueredo</span>
        </footer>
      )}

      {/* Scrollbar + animações */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 10px; }

        .welcome-star {
          animation: starFloat 3s ease-in-out infinite, starGlow 2s ease-in-out infinite alternate;
        }
        @keyframes starFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes starGlow {
          from { filter: drop-shadow(0 0 10px rgba(212,175,55,0.3)); }
          to { filter: drop-shadow(0 0 25px rgba(212,175,55,0.6)); }
        }

        .welcome-fade-in {
          animation: fadeInUp 1s ease-out 0.3s both;
        }
        .welcome-fade-in-delay {
          animation: fadeInUp 1s ease-out 0.8s both;
        }
        .welcome-fade-in-delay2 {
          animation: fadeInUp 1s ease-out 1.3s both;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .recording-bar {
          animation: recordingWave 1s ease-in-out infinite;
        }
        @keyframes recordingWave {
          0%, 100% { height: 8px; }
          50% { height: 32px; }
        }

        .menu-slide-in {
          animation: slideInLeft 0.25s ease-out;
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default App;
