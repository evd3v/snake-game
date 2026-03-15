<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiUpload, apiDelete } from '@/api/client'

interface Book {
  id: number
  title: string
  author: string | null
  coverBase64: string | null
  totalPages: number
  createdAt: string
}

const books = ref<Book[]>([])
const uploading = ref(false)
const error = ref<string | null>(null)

async function fetchBooks() {
  try {
    books.value = await apiGet<Book[]>('/books')
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load books'
  }
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  error.value = null
  try {
    await apiUpload('/books/upload', file)
    await fetchBooks()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Upload failed'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function deleteBook(book: Book) {
  if (!window.confirm(`Delete "${book.title}"?`)) return

  try {
    await apiDelete(`/books/${book.id}`)
    books.value = books.value.filter(b => b.id !== book.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

onMounted(fetchBooks)
</script>

<template>
  <div class="library">
    <div class="library-header">
      <h1 class="library-title">Library</h1>
      <label class="upload-btn" :class="{ disabled: uploading }">
        <span v-if="uploading" class="upload-spinner"></span>
        <span v-else class="upload-icon">+</span>
        {{ uploading ? 'Uploading...' : 'Upload EPUB' }}
        <input
          type="file"
          accept=".epub"
          class="file-input"
          :disabled="uploading"
          @change="handleUpload"
        />
      </label>
    </div>

    <div v-if="error" class="error-banner">
      <p class="error-message">{{ error }}</p>
      <button class="dismiss-btn" @click="error = null">&times;</button>
    </div>

    <div v-if="books.length === 0 && !uploading" class="empty-state">
      <div class="empty-icon">📚</div>
      <p class="empty-text">No books yet. Upload an EPUB to get started.</p>
    </div>

    <div v-else class="book-grid">
      <div v-for="book in books" :key="book.id" class="book-card">
        <div class="book-cover">
          <img
            v-if="book.coverBase64"
            :src="book.coverBase64"
            :alt="book.title"
            class="cover-image"
          />
          <div v-else class="cover-placeholder">
            <span class="placeholder-letter">{{ book.title.charAt(0).toUpperCase() }}</span>
          </div>
        </div>
        <div class="book-info">
          <h3 class="book-title">{{ book.title }}</h3>
          <p v-if="book.author" class="book-author">{{ book.author }}</p>
          <p class="book-pages">{{ book.totalPages }} pages</p>
        </div>
        <button class="delete-btn" title="Delete book" @click="deleteBook(book)">
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.library-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #2563eb;
  border-radius: 6px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.upload-btn:hover:not(.disabled) {
  background: #1d4ed8;
}

.upload-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-icon {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.upload-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.file-input {
  display: none;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
}

.error-message {
  margin: 0;
  color: #dc2626;
  font-size: 14px;
}

.dismiss-btn {
  background: none;
  border: none;
  color: #dc2626;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #64748b;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  margin: 0;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.book-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: box-shadow 0.15s;
}

.book-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.book-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  background: #f1f5f9;
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
}

.placeholder-letter {
  font-size: 48px;
  font-weight: 700;
  color: #4f46e5;
}

.book-info {
  padding: 12px;
}

.book-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-author {
  margin: 0 0 4px;
  font-size: 13px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-pages {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.book-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #dc2626;
}

@media (max-width: 768px) {
  .book-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .book-grid {
    grid-template-columns: 1fr;
  }
}
</style>
