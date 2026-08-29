import React, { useState, useEffect } from "react";
import { AppState } from "../../types";
import {
  testSupabaseConnection,
  supabasePushAll,
  supabasePullAll,
  generateSqlSetupScript,
  getAutoSyncPreference,
  setAutoSyncPreference,
} from "../../lib/supabase";
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  Cloud,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
} from "lucide-react";

interface SyncViewProps {
  state: AppState;
  onApplyRemoteState: (newState: Partial<AppState>) => void;
  onShowToast: (msg: string) => void;
}

export const SyncView: React.FC<SyncViewProps> = ({
  state,
  onApplyRemoteState,
  onShowToast,
}) => {
  const [autoSync, setAutoSync] = useState(getAutoSyncPreference());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    tablesFound: string[];
  } | null>(null);

  const [syncingUp, setSyncingUp] = useState(false);
  const [syncingDown, setSyncingDown] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);

  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    setAutoSyncPreference(enabled);
    onShowToast(enabled ? "Cloud auto-sync enabled" : "Cloud auto-sync paused");
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await testSupabaseConnection();
      setConnectionResult(res);
    } catch (e: any) {
      setConnectionResult({
        success: false,
        message: e.message || "Failed to reach cloud database backend",
        tablesFound: [],
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handlePushAll = async () => {
    setSyncingUp(true);
    try {
      const res = await supabasePushAll(state);
      setLastSyncedTime(new Date().toLocaleTimeString());
      onShowToast(res.message || "Data securely exported to cloud");
    } catch (e: any) {
      onShowToast(`Sync error: ${e.message}`);
    } finally {
      setSyncingUp(false);
    }
  };

  const handlePullAll = async () => {
    setSyncingDown(true);
    try {
      const remote = await supabasePullAll();
      onApplyRemoteState(remote);
      setLastSyncedTime(new Date().toLocaleTimeString());
      onShowToast("Latest data restored from cloud database");
    } catch (e: any) {
      onShowToast(`Restore error: ${e.message}`);
    } finally {
      setSyncingDown(false);
    }
  };

  const handleCopySql = () => {
    const sql = generateSqlSetupScript();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      onShowToast("SQL Schema copied to clipboard");
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div>
        <h2 className="text-xl font-extrabold text-[#2B2740]">Cloud Database Sync</h2>
        <p className="text-xs text-[#2B2740]/60 mt-1">
          Synchronize your household ledger with your private Supabase PostgreSQL database securely via server proxy.
        </p>
      </div>

      {/* Primary Cloud Database Card */}
      <div className="bg-white rounded-[22px] p-5 shadow-sm border border-[#7C3AED]/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#B0459E] flex items-center justify-center text-white shadow-xs">
              <Database size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-[#2B2740]">Supabase PostgreSQL Database</h3>
              <p className="text-[11px] text-[#2B2740]/50">Protected server-side persistence</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connectionResult?.success ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 size={13} />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                <AlertCircle size={13} />
                <span>Checking...</span>
              </span>
            )}
          </div>
        </div>

        {/* Security / Backend Proxy Notice */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[#7C3AED]/5 border border-[#7C3AED]/10 text-xs text-[#2B2740]">
          <ShieldCheck size={16} className="text-[#7C3AED] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-[#7C3AED]">Zero-Exposure Security Architecture</div>
            <div className="text-[11px] text-[#2B2740]/60 leading-relaxed">
              All database credentials and keys are securely encapsulated in the server environment. No secrets or tokens are ever exposed to the client or browser network logs.
            </div>
          </div>
        </div>

        {/* Connection Diagnostics */}
        {connectionResult && (
          <div
            className={`p-3.5 rounded-2xl text-xs space-y-1.5 border ${
              connectionResult.success
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-rose-50/70 border-rose-200 text-rose-900"
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              {connectionResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{connectionResult.message}</span>
            </div>

            {connectionResult.tablesFound && connectionResult.tablesFound.length > 0 && (
              <div className="text-[11px] opacity-80">
                Active tables: <strong>{connectionResult.tablesFound.join(", ")}</strong>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handlePushAll}
              disabled={syncingUp}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#B0459E] text-white font-bold text-xs shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {syncingUp ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <ArrowUpCircle size={15} />
              )}
              <span>{syncingUp ? "Pushing Data..." : "Push to Cloud Database"}</span>
            </button>

            <button
              onClick={handlePullAll}
              disabled={syncingDown}
              className="py-3 px-4 rounded-xl bg-white border border-[#7C3AED]/30 text-[#7C3AED] font-bold text-xs shadow-xs hover:bg-[#7C3AED]/5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {syncingDown ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <ArrowDownCircle size={15} />
              )}
              <span>{syncingDown ? "Restoring Data..." : "Pull & Restore from Cloud"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="px-3.5 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-[#2B2740]/70 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw size={13} className={testingConnection ? "animate-spin" : ""} />
              <span>Verify Status</span>
            </button>

            <button
              onClick={() => setShowSqlModal(true)}
              className="px-3.5 py-2 rounded-xl text-[#7C3AED] hover:bg-[#7C3AED]/10 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Terminal size={14} />
              <span>View SQL Schema</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Sync & Preference Card */}
      <div className="bg-white rounded-[22px] p-5 shadow-sm border border-black/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#5FD3A3]/10 text-[#5FD3A3] flex items-center justify-center">
            <Cloud size={16} />
          </div>
          <div>
            <div className="text-xs font-extrabold text-[#2B2740]">Automatic Background Sync</div>
            <div className="text-[11px] text-[#2B2740]/50">
              Synchronize changes automatically on financial entry updates
            </div>
          </div>
        </div>

        <button
          onClick={() => handleToggleAutoSync(!autoSync)}
          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
            autoSync ? "bg-[#7C3AED]" : "bg-black/10"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
              autoSync ? "right-1" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* SQL Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-[#141028]/50 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-[24px] p-6 max-w-lg w-full shadow-2xl border border-black/10 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-[#2B2740]">Supabase SQL Schema</h3>
                <p className="text-xs text-[#2B2740]/60">Run once in Supabase SQL Editor if creating a new database</p>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-[#2B2740]/40 hover:text-[#2B2740] font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-[#2B2740] text-emerald-400 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed select-all">
              <pre>{generateSqlSetupScript()}</pre>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCopySql}
                className="flex-1 py-3 rounded-full bg-[#7C3AED] text-white font-bold text-xs shadow-md hover:bg-[#6D3AED] flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedSql ? "Copied SQL to Clipboard!" : "Copy SQL Script"}</span>
              </button>
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-3 rounded-full bg-black/5 text-[#2B2740]/60 font-bold text-xs hover:bg-black/10 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Footer Status */}
      {lastSyncedTime && (
        <div className="bg-white/70 rounded-2xl p-3.5 border border-black/[0.04] text-xs text-[#2B2740]/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="font-medium">Last synced successfully</span>
          </div>
          <div className="font-mono text-[#7C3AED] font-bold text-[11px]">
            {lastSyncedTime}
          </div>
        </div>
      )}
    </div>
  );
};
