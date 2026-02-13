import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    // 1. Define a pasta raiz de desenvolvimento
    root: 'src',

    // 2. Base Path Dinâmico: 
    // No dev usa a raiz '/'. No build usa o nome do repositório no GitHub.
    base: isBuild ? '/quiz-biblico/' : '/',

    plugins: [
      viteStaticCopy({
        targets: [
          {
            // Pega as pastas de src e joga na raiz de dist
            src: ['quizes/**/*', 'img/**/*'],
            dest: './' 
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

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },

    server: {
      port: 5173,
      open: true
    }
  }
})
