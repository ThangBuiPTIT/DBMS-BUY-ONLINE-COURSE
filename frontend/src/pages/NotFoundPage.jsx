import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Home, LogIn } from 'lucide-react';
import { Card, PrimaryButton, GhostButton } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { navigate } from '../lib/router';

export default function NotFoundPage() {
  const { user } = useAuth();
  const home =
    user?.role_name === 'ADMIN'
      ? '/admin/dashboard'
      : user?.role_name === 'TEACHER'
        ? '/teacher/dashboard'
        : user?.role_name === 'STUDENT'
          ? '/student/dashboard'
          : '/';

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card padding="p-10" className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-primary-light border border-primary/30 text-primary flex items-center justify-center">
            <Compass size={36} strokeWidth={1.6} />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-primary font-bold">404</span>
            <h1 className="text-2xl font-bold text-heading mt-1">Không tìm thấy trang</h1>
            <p className="text-sm text-muted mt-2">
              Đường dẫn bạn vừa mở không tồn tại hoặc đã được di chuyển. Hãy quay về trang chính.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <PrimaryButton
              icon={<Home size={14} strokeWidth={1.8} />}
              onClick={() => navigate(home)}
            >
              Về trang chính
            </PrimaryButton>
            {!user && (
              <GhostButton
                icon={<LogIn size={14} strokeWidth={1.8} />}
                onClick={() => navigate('/')}
              >
                Đăng nhập
              </GhostButton>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}