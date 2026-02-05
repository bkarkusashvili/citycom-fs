import { Link } from 'react-router-dom';

interface AuthLinkProps {
  text: string;
  linkText: string;
  to: string;
}

export function AuthLink({ text, linkText, to }: AuthLinkProps) {
  return (
    <p className="text-center text-sm text-gray-600">
      {text}{' '}
      <Link to={to} className="text-blue-600 hover:text-blue-500">
        {linkText}
      </Link>
    </p>
  );
}
