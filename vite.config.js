import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy' // <--- 1. Importação do plugin

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    root: 'src',
    base: './', // Caminho relativo para funcionar em qualquer lugar

    // =========================
    // 🔌 Configuração dos Plugins
    // =========================
    plugins: [
      viteStaticCopy({
        targets: [
          {
            // Pega a pasta 'quizes' dentro de 'src'
            src: 'quizes', 
            // Copia para a raiz da pasta 'dist' (mantendo o nome da pasta)
            dest: '' 
          },
          {
            // Pega a pasta 'img' dentro de 'src'
            src: 'img', 
            // Copia para a raiz da pasta 'dist'
            dest: '' 
          }
        ]
      })
    ],

    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: isDev,
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
