import { useState, useEffect } from 'react'
// Ajustado o caminho para apontar para a raiz, onde o arquivo supabase.ts se encontra
import { supabase } from './supabase'

interface Todo {
  id: string | number;
  name: string;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    async function getTodos() {
      const { data: todos, error } = await supabase.from('todos').select()

      if (error) {
        // Error handling can be added here.
      } else if (todos) {
        setTodos(todos)
      }
    }

    getTodos()
  }, [])

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}