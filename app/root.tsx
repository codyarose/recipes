import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from '@remix-run/react'
import './tailwind.css'
import { PropsWithChildren } from 'react'
import { GeneralErrorBoundary } from './components/GeneralErrorBoundary'

export default function App() {
	return (
		<Document>
			<Outlet />
		</Document>
	)
}

function Document({ children }: PropsWithChildren<{}>) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary() {
	return (
		<Document>
			<GeneralErrorBoundary />
		</Document>
	)
}
