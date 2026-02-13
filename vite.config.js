import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'

  return {
    // =========================
    // 📁 Raiz do projeto fonte
    // =========================
    root: 'src',

    // =========================
    // 🌍 Base path (Dinâmico)
    // =========================
    // No dev: '/' (raiz do localhost)
    // Na build: '/quiz-biblico/' (nome exato do seu repositório no GitHub)
    base: isBuild ? '/quiz-biblico/' : '/',

    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'quizes', 
            dest: '' // Copia src/quizes para dist/quizes
          },
          {
            src: 'img', 
            dest: '' // Copia src/img para dist/img
          }
        ]
      })
    ],

    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: !isBuild,
      assetsDir: 'assets',

      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
          quiz: resolve(__dirname, 'src/quiz.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        }
      }
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@js': resolve(__dirname, 'src/js'),
        '@css': resolve(__dirname, 'src/css'),
        '@img': resolve(__dirname, 'src/img')
      }
    },

    server: {
      port: 5173,
      open: true,
      strictPort: true
    },

    preview: {
      port: 4173,
      open: true
    }
  }
})
