import { PropsWithChildren } from 'react'
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from '@remix-run/react'
import { GeneralErrorBoundary } from './components/GeneralErrorBoundary'
import './tailwind.css'

export default function App() {
	return (
		<Document>
			<Outlet />
			<footer className="h-20 w-full" />
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
			<body className="grid min-h-dvh grid-rows-[1fr_min-content]">
				{children}
				<ScrollRestoration getKey={location => location.pathname} />
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
