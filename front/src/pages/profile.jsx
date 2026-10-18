import { useEffect, useMemo, useState } from "react";
import { useRouteLoaderData } from "react-router";
import { Input } from "@/src/components/ui/inputs";
import { PrimaryButton } from "@/src/components/ui/buttons";
import { sendBackRequest } from "@/src/services/backend";
import { logger } from "@/src/services/logger";
import { notify } from "@/src/components/ui/sonnar/sonnar";
import Card from "@/src/components/ui/card";
import { setMetas } from "@/src/services/metas";
import NotificationPermissionPrompt from "@/src/components/notifications/permissionPrompt";

export default function Profile() {

    setMetas({
        title: 'Profile',
        // description: '',
        // icon: GLOBALS.LOGO.MAIN,
    });

    const rootAuthData = useRouteLoaderData('root');
    // logger.info('rootAuthData:', rootAuthData);

    const [profile, setProfile] = useState({
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        status: '',
        provider: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [password, setPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
    const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');

    const userId = rootAuthData?.id || null;

    const fetchProfile = async () => {
        if (!userId) {
            setErrorMsg('Unable to load profile: missing user session.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setErrorMsg('');
        const res = await sendBackRequest({
            itsFor: 'profile',
            action: 'get',
            method: 'POST',
            data: { userId },
        });
        // logger.info('res: ', res);

        if (!res.success) {
            setErrorMsg(res.message || 'Failed to load profile');
        } else if (res.data) {
            setProfile({
                id: res.data.id || '',
                email: res.data.email || '',
                firstName: res.data.firstName || '',
                lastName: res.data.lastName || '',
                status: res.data.status || '',
                provider: res.data.provider || '',
            });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const onFieldChange = (event) => {
        const { name, value } = event.target;
        setProfile((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const onSave = async (event) => {
        event.preventDefault();
        setSuccessMsg('');
        setErrorMsg('');

        if (!userId) {
            setErrorMsg('Unable to save profile: missing user session.');
            return;
        }

        setIsSaving(true);
        const res = await sendBackRequest({
            itsFor: 'profile',
            action: 'update',
            method: 'POST',
            data: {
                userId,
                firstName: profile.firstName,
                lastName: profile.lastName,
            },
        });

        if (!res.success) {
            setErrorMsg(res.message || 'Failed to save profile');
            logger.error('Profile save failed', res);
        } else {
            notify({ type: 'success', message: res.message || 'Profile saved successfully' });
            setSuccessMsg(res.message || 'Profile saved successfully');
            if (res.data) {
                setProfile((prev) => ({
                    ...prev,
                    firstName: res.data.firstName || '',
                    lastName: res.data.lastName || '',
                    status: res.data.status || '',
                    provider: res.data.provider || '',
                    email: res.data.email || prev.email,
                }));
            }
        }

        setIsSaving(false);
    };

    const onPasswordSave = async (event) => {
        event.preventDefault();
        setPasswordSuccessMsg('');
        setPasswordErrorMsg('');

        if (!userId) {
            setPasswordErrorMsg('Unable to update password: missing user session.');
            return;
        }

        if (!password) {
            setPasswordErrorMsg('Password is required.');
            return;
        }

        setIsSavingPassword(true);
        const res = await sendBackRequest({
            itsFor: 'profile',
            action: 'password',
            method: 'POST',
            data: {
                userId,
                password,
            },
        });

        if (!res.success) {
            setPasswordErrorMsg(res.message || 'Failed to update password');
            logger.error('Profile password update failed', res);
        } else {
            notify({ type: 'success', message: res.message || 'Password updated successfully' });
            setPasswordSuccessMsg(res.message || 'Password updated successfully');
            setPassword('');
        }

        setIsSavingPassword(false);
    };

    return (
        <div className="w-full mx-auto mt-6 space-y-5">

            <Card className="">
                <div className="mb-5">
                    <h1 className="text-xl font-semibold">My Profile</h1>
                    <p className="text-sm opacity-65">Manage your account details.</p>
                </div>

                {isLoading ? (
                    <div className="text-sm opacity-70">Loading profile...</div>
                ) : (
                    <form onSubmit={onSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">First Name</label>
                                <Input
                                    name="firstName"
                                    value={profile.firstName}
                                    onChange={onFieldChange}
                                    placeholder="Enter first name"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Last Name</label>
                                <Input
                                    name="lastName"
                                    value={profile.lastName}
                                    onChange={onFieldChange}
                                    placeholder="Enter last name"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Email</label>
                                <Input
                                    name="email"
                                    value={profile.email}
                                    disabled
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium">Status</label>
                                <Input
                                    name="status"
                                    value={profile.status}
                                    disabled
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium">Provider</label>
                            <Input
                                name="provider"
                                value={profile.provider}
                                disabled
                            />
                        </div>

                        {errorMsg ? (
                            <p className="text-sm text-red-600">{errorMsg}</p>
                        ) : null}

                        {successMsg ? (
                            <p className="text-sm text-green-700">{successMsg}</p>
                        ) : null}

                        <div className="pt-2">
                            <PrimaryButton type="submit" isLoading={isSaving}>
                                Save Profile
                            </PrimaryButton>
                        </div>
                    </form>
                )}
            </Card>

            {!isLoading &&
                <Card className="">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold">Password</h2>
                        <p className="text-sm opacity-65">Update your account password.</p>
                    </div>

                    <form onSubmit={onPasswordSave} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium">Password</label>
                            <Input
                                type="password"
                                name="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter new password"
                            />
                        </div>

                        {passwordErrorMsg ? (
                            <p className="text-sm text-red-600">{passwordErrorMsg}</p>
                        ) : null}

                        {passwordSuccessMsg ? (
                            <p className="text-sm text-green-700">{passwordSuccessMsg}</p>
                        ) : null}

                        <div className="pt-2">
                            <PrimaryButton type="submit" isLoading={isSavingPassword}>
                                Update Password
                            </PrimaryButton>
                        </div>
                    </form>
                </Card>
            }


            <NotificationPermissionPrompt />

        </div>
    );
}