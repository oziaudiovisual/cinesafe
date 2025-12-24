import React, { memo } from 'react';

interface UserAvatarProps {
  user: {
    name: string;
    avatarUrl: string;
  };
}

const UserAvatarComponent: React.FC<UserAvatarProps> = ({ user }) => {
    if (!user) return null;

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.split(' ');
        if (parts.length > 1 && parts[parts.length - 1]) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const COLORS = ['bg-orange-500', 'bg-sky-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-slate-500'];
    const colorForName = (name: string) => {
        if (!name) return COLORS[0];
        const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return COLORS[charCodeSum % COLORS.length];
    };

    const isDefaultAvatar = !user.avatarUrl || user.avatarUrl.includes('ui-avatars.com');

    if (isDefaultAvatar) {
        return (
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border border-white/20 ${colorForName(user.name)}`}>
                {getInitials(user.name)}
            </div>
        );
    }

    return (
        <div className="w-8 h-8 rounded-full bg-brand-600 overflow-hidden border border-brand-500 shrink-0">
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        </div>
    );
};

export const UserAvatar = memo(UserAvatarComponent);
