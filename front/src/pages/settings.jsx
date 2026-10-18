import { setMetas } from "@/src/services/metas";

export default function Settings() {

    setMetas({
        title: 'Settings',
        // description: '',
        // icon: GLOBALS.LOGO.MAIN,
    });
    return (
        <div>
            Settings
        </div>
    );
}