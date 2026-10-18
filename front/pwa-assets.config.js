import {
    defineConfig,
    minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config'
import { GLOBALS } from './globals.js';


export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset,
    images: ['./public/' + GLOBALS.LOGO.SMALL],
})
