import { useState, useEffect } from 'react';

import { Card, Typography, Button, List, Avatar, Tag, Input, Modal, Spin, message, Tooltip, Select, Popconfirm } from 'antd';
import { UserOutlined, CopyOutlined, PlusOutlined } from '@ant-design/icons';
import { ProjectAPI } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const { Title, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const serverHost = window.location.protocol + '//' + window.location.host

interface Member {
    id: number;
    user_id: number;
    username: string;
    email: string;
    nickname?: string;
    role: 'admin' | 'member' | 'readonly';
    avatar?: string;
}

interface MembersSectionProps {
    projectId?: string;
}

export function MembersSection({ projectId }: MembersSectionProps) {
    
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [, setLinkCopied] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | 'readonly' | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (projectId) {
            loadMembers();
        }
    }, [projectId]);

    const loadMembers = () => {
        setLoading(true);
        ProjectAPI.getProjectMembers(parseInt(projectId!))
            .then(res => {
                setMembers(res.data);
                // 获取当前用户角色
                const me = res.data.find((m: Member) => m.user_id === Number(user?.id));
                setCurrentUserRole(me?.role || null);
            })
            .catch(err => {
                console.error('加载成员列表失败', err);
                message.error('加载成员列表失败');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const handleInvite = () => {
        if (!inviteEmail.trim()) {
            message.warning('请输入邮箱地址');
            return;
        }

        setInviteLoading(true);
        ProjectAPI.inviteMember(parseInt(projectId!), inviteEmail, 'member')
            .then(() => {
                message.success('邀请已发送');
                setInviteModalVisible(false);
                setInviteEmail('');
            })
            .catch(err => {
                console.error('邀请失败', err);
                message.error('邀请失败' + ': ' + (err.message || '未知错误'));
            })
            .finally(() => {
                setInviteLoading(false);
            });
    };

    const handleGenerateInviteLink = () => {
        ProjectAPI.generateInviteLink(parseInt(projectId!))
            .then(res => {
                setInviteLink(`${serverHost}${res.data.inviteUrl}`);
            })
            .catch(err => {
                const errorMessage = err.response?.data?.detail || '生成邀请链接失败';
                console.error('生成邀请链接失败', err);
                message.error(errorMessage);
            });
    };

    const copyInviteLink = async () => {
        const success = await copyToClipboard(inviteLink);
        if (success) {
            setLinkCopied(true);
            message.success('邀请链接已复制到剪贴板');
            setTimeout(() => setLinkCopied(false), 3000);
        } else {
            message.error('复制失败');
        }
    };

    const handleRemoveMember = (memberId: number) => {
        ProjectAPI.removeMember(parseInt(projectId!), memberId)
            .then(() => {
                message.success('成员已移除');
                // 在members列表中移除该成员
                setMembers(members.filter(m => m.id !== memberId));
            })
            .catch(err => {
                console.error('移除成员失败', err);
                message.error('移除成员失败');
            });
    };

    const handleChangeRole = (member: Member, newRole: 'admin' | 'member' | 'readonly') => {
        if (member.role === newRole) return;
        ProjectAPI.updateMemberRole(parseInt(projectId!), member.id, newRole)
            .then(() => {
                message.success('权限更新成功');
                setMembers(members.map(m => m.id === member.id ? { ...m, role: newRole } : m));
            })
            .catch(err => {
                console.error('修改权限失败', err);
                message.error('修改权限失败');
            });
    };

    return (
        <div>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Title level={4}>{'成员管理'}</Title>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setInviteModalVisible(true)}
                    >
                        {'邀请成员'}
                    </Button>
                </div>

                <Paragraph>
                    {'管理项目成员和权限。只有管理员可以邀请、移除成员和修改权限。'}
                </Paragraph>

                {loading ? (
                    <Spin />
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={members}
                        renderItem={member => (
                            <List.Item
                                actions={[
                                    <Select
                                        value={member.role}
                                        style={{ width: 120 }}
                                        onChange={role => handleChangeRole(member, role as any)}
                                        disabled={currentUserRole !== 'admin'}
                                    >
                                        <Option value="admin">{'管理员'}</Option>
                                        <Option value="member">{'成员'}</Option>
                                        <Option value="readonly">{'只读'}</Option>
                                    </Select>,
                                    <Popconfirm
                                        title={'确认移除此成员？'}
                                        onConfirm={() => handleRemoveMember(member.id)}
                                        okText={'确定'}
                                        cancelText={'取消'}
                                        disabled={currentUserRole !== 'admin'}
                                    >
                                        <Button
                                            type="link"
                                            danger
                                            disabled={currentUserRole !== 'admin'}
                                        >
                                            {'移除'}
                                        </Button>
                                    </Popconfirm>
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={<Avatar icon={<UserOutlined />} src={member.avatar} />}
                                    title={
                                        <div>
                                            {member.nickname || member.username || member.email}
                                            {member.role === 'admin' && <Tag color="blue" style={{ marginLeft: 8 }}>{'管理员'}</Tag>}
                                            {member.role === 'readonly' && <Tag color="gray" style={{ marginLeft: 8 }}>{'只读'}</Tag>}
                                        </div>
                                    }
                                    description={member.username || member.email}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            {/* 邀请模态框 */}
            <Modal
                title={'邀请成员'}
                open={inviteModalVisible}
                onCancel={() => setInviteModalVisible(false)}
                footer={null}
            >
                <div style={{ marginBottom: 16 }}>
                    <Title level={5}>{'通过邮箱邀请'}</Title>
                    <Search
                        placeholder={'输入邮箱地址'}
                        enterButton={'发送邀请'}
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        onSearch={handleInvite}
                        loading={inviteLoading}
                        disabled={true}
                    />
                </div>

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>{'通过链接邀请'}</Title>
                    {
                        !inviteLink ? (
                            <Button
                                onClick={handleGenerateInviteLink}
                            >
                                {'生成邀请链接'}
                            </Button>
                        ) : (
                            <Input.Group compact>
                                <Input
                                    style={{ width: 'calc(100% - 32px)' }}
                                    value={inviteLink}
                                    readOnly
                                />
                                <Tooltip title={'复制链接'}>
                                    <Button icon={<CopyOutlined />} onClick={copyInviteLink} />
                                </Tooltip>
                            </Input.Group>
                        )
                    }
                </div>
            </Modal>
        </div>
    );
} 