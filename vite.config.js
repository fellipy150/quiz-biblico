import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    root: 'src',
    base: isBuild ? '/quiz-biblico/' : '/',

    plugins: [
      viteStaticCopy({
        targets: [
          // 1. Copia as pastas de conteúdo
          {
            src: 'quizes', // Pega a pasta inteira src/quizes
            dest: ''       // Joga na raiz de dist/
          },
          {
            src: 'img',    // Pega a pasta inteira src/img
            dest: ''       // Joga na raiz de dist/
          },
          // 2. CRUCIAL: Cria o arquivo .nojekyll para o GitHub não bloquear JSON/MD
          {
            src: '../.nojekyll', // Vamos criar esse arquivo na raiz do projeto agora
            dest: ''
          }
        ]
      })
    ],

    build: {
      outDir: '../dist',
      emptyOutDir: true,
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
          quiz: resolve(__dirname, 'src/quiz.html'),
          train: resolve(__dirname, 'src/train.html')
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    },
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    server: { port: 5173, open: true }
  }
})
